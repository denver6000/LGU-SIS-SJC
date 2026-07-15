<?php

/**
 * Read-only by default. Import Firestore student-connected data into MySQL/MariaDB.
 *
 * Required environment variables for --write:
 *   DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD
 *
 * Google authentication:
 *   GCP_SERVICE_ACCOUNT (recommended; gcloud impersonates this account), or
 *   GOOGLE_APPLICATION_CREDENTIALS, or an authenticated gcloud ADC session.
 *
 * The script intentionally does not read or import payoutRecords, operationLogs,
 * payroll fields, or payroll history fields embedded in student documents.
 */

declare(strict_types=1);

const DEFAULT_PROJECT = 'lgus-sjc-scholarship';
const DEFAULT_DATABASE = '(default)';

$options = getopt('', ['write', 'export:', 'bootstrap-schema', 'project:', 'database:', 'log:']);
$write = array_key_exists('write', $options);
$project = (string) ($options['project'] ?? getenv('GCP_PROJECT_ID') ?: DEFAULT_PROJECT);
$database = (string) ($options['database'] ?? getenv('FIRESTORE_DATABASE') ?: DEFAULT_DATABASE);
$exportPath = $options['export'] ?? null;
$logFile = (string) ($options['log'] ?? (__DIR__ . '/../storage/logs/firestore-to-mysql-' . date('Ymd-His') . '.log'));

if (!is_dir(dirname($logFile))) mkdir(dirname($logFile), 0775, true);

function logMessage(string $message): void
{
    global $logFile;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    fwrite(STDOUT, $line);
}

if (!$write && !$exportPath) {
    fwrite(STDOUT, "Dry run only. Use --export=path.json to save the transformed payload or --write to import into MySQL.\n");
}

function envOrFail(string $name): string
{
    $value = getenv($name);
    if ($value === false || trim($value) === '') {
        throw new RuntimeException("Missing environment variable: {$name}");
    }
    return trim($value);
}

function shellOutput(string $command, bool $includeErrors = true): string
{
    $output = [];
    $exitCode = 0;
    $redirect = $includeErrors ? ' 2>&1' : (PHP_OS_FAMILY === 'Windows' ? ' 2>NUL' : ' 2>/dev/null');
    exec($command . $redirect, $output, $exitCode);
    if ($exitCode !== 0) {
        throw new RuntimeException("Command failed ({$exitCode}): " . implode("\n", $output));
    }
    return trim(implode("\n", $output));
}

function googleAccessToken(): string
{
    $serviceAccount = getenv('GCP_SERVICE_ACCOUNT');
    if ($serviceAccount !== false && trim($serviceAccount) !== '') {
        return trim(shellOutput('gcloud auth print-access-token --impersonate-service-account=' . escapeshellarg(trim($serviceAccount)), false));
    }

    // This uses the caller's configured ADC. It never writes a service-account key.
    return trim(shellOutput('gcloud auth application-default print-access-token', false));
}

function firestoreValue(mixed $value): mixed
{
    if (!is_array($value)) return $value;
    if (array_key_exists('nullValue', $value)) return null;
    if (array_key_exists('stringValue', $value)) return $value['stringValue'];
    if (array_key_exists('booleanValue', $value)) return $value['booleanValue'];
    if (array_key_exists('integerValue', $value)) return (int) $value['integerValue'];
    if (array_key_exists('doubleValue', $value)) return (float) $value['doubleValue'];
    if (array_key_exists('timestampValue', $value)) return $value['timestampValue'];
    if (array_key_exists('referenceValue', $value)) return $value['referenceValue'];
    if (array_key_exists('bytesValue', $value)) return $value['bytesValue'];
    if (array_key_exists('arrayValue', $value)) {
        return array_map('firestoreValue', $value['arrayValue']['values'] ?? []);
    }
    if (array_key_exists('mapValue', $value)) {
        $result = [];
        foreach (($value['mapValue']['fields'] ?? []) as $key => $item) $result[$key] = firestoreValue($item);
        return $result;
    }
    return array_map('firestoreValue', $value);
}

function firestoreRequest(string $url, string $token): array
{
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Accept: application/json'],
            CURLOPT_TIMEOUT => 120,
        ]);
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle);
        curl_close($handle);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'GET',
            'header' => "Authorization: Bearer {$token}\r\nAccept: application/json\r\n",
            'timeout' => 120,
            'ignore_errors' => true,
        ]]);
        $body = file_get_contents($url, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int) $match[1];
        }
        $error = error_get_last()['message'] ?? '';
    }
    if ($body === false || $status < 200 || $status >= 300) {
        throw new RuntimeException("Firestore request failed ({$status}): {$error} " . (string) $body);
    }
    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}

function listCollection(string $project, string $database, string $collection, string $token): array
{
    logMessage("Reading Firestore collection: {$collection}");
    $documents = [];
    $pageToken = null;
    do {
        $url = 'https://firestore.googleapis.com/v1/projects/' . rawurlencode($project)
            . '/databases/' . rawurlencode($database) . '/documents/' . rawurlencode($collection)
            . '?pageSize=300';
        if ($pageToken) $url .= '&pageToken=' . rawurlencode($pageToken);
        $response = firestoreRequest($url, $token);
        foreach (($response['documents'] ?? []) as $document) {
            $name = (string) ($document['name'] ?? '');
            $id = basename($name);
            $documents[] = ['id' => $id, 'data' => firestoreValue($document['fields'] ?? [])];
        }
        $pageToken = $response['nextPageToken'] ?? null;
    } while ($pageToken);
    logMessage("Read {$collection}: " . count($documents) . ' documents');
    return $documents;
}

function stringValue(mixed $value): ?string
{
    if ($value === null) return null;
    $value = is_scalar($value) ? (string) $value : null;
    $value = $value === null ? null : trim($value);
    return $value === '' ? null : $value;
}

function boolValue(mixed $value): bool { return $value === true || $value === 1 || $value === '1'; }

function jsonValue(mixed $value): ?string
{
    return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function withoutPayrollData(mixed $value): mixed
{
    $excluded = [
        'payoutRecords', 'payrollRecords', 'payroll_id', 'payroll_status', 'payroll_record_type',
        'payrolled', 'payrolled_at', 'payrolled_by_uid', 'payrolled_by_email', 'renewal_status',
        'renewed', 'renewed_at', 'claimed', 'claimed_at',
    ];
    if (!is_array($value)) return $value;
    $result = [];
    foreach ($value as $key => $item) {
        if (in_array((string) $key, $excluded, true)) continue;
        $result[$key] = withoutPayrollData($item);
    }
    return $result;
}

function optionRows(array $documents, string $collection): array
{
    $rows = [];
    foreach ($documents as $document) {
        $data = $document['data'];
        $name = stringValue($data['name'] ?? null);
        if (!$name) continue;
        $rows[] = ['collection_name' => $collection, 'source_id' => $document['id'], 'name' => $name, 'added_at' => stringValue($data['added_at'] ?? null)];
    }
    return $rows;
}

function cycleParts(array $record): ?array
{
    $schoolYear = stringValue($record['school_year'] ?? null);
    $semester = (int) ($record['sem_number'] ?? 0);
    if (!$schoolYear || !in_array($semester, [1, 2], true)) return null;
    return [$schoolYear, $semester];
}

function requirementPayload(array $record, array $student): array
{
    $initial = $record['initial_payout_requirements'] ?? $student['requirements'] ?? [];
    $renewal = $record['renewal_requirements'] ?? $record['requirements'] ?? [];
    return [
        'initial_certificate_of_residency' => boolValue($initial['certificate_of_residency'] ?? false),
        'initial_pagpapatunay_form' => boolValue($initial['pagpapatunay_form'] ?? false),
        'initial_picture_of_house' => boolValue($initial['picture_of_the_house'] ?? false),
        'initial_good_moral' => boolValue($initial['good_moral_certificate'] ?? false),
        'initial_certificate_of_grades' => boolValue($initial['original_certificate_of_grades'] ?? false),
        'initial_proof_of_enrollment' => boolValue($initial['proof_of_enrollment'] ?? false),
        'renewal_liquidation' => boolValue($renewal['liquidation'] ?? false),
        'renewal_proof_of_enrollment' => boolValue($renewal['proof_of_enrollment'] ?? false),
        'renewal_latest_grades' => boolValue($renewal['latest_grades'] ?? false),
    ];
}

function transformStudents(array $documents): array
{
    $students = [];
    $cycles = [];
    $requirements = [];

    foreach ($documents as $document) {
        $source = $document['data'];
        $studentId = stringValue($source['student_id'] ?? $document['id']);
        $fullName = stringValue($source['full_name'] ?? null);
        if (!$studentId || !$fullName) continue;

        $semesterRecords = is_array($source['semester_records'] ?? null) ? $source['semester_records'] : [];
        $students[] = [
            'student_id' => $studentId,
            'full_name' => $fullName,
            'student_number' => stringValue($source['student_number'] ?? null),
            'barangay' => stringValue($source['barangay'] ?? null),
            'address' => stringValue($source['address'] ?? null),
            'phone_number' => stringValue($source['phone_number'] ?? null),
            'legacy_data' => jsonValue(withoutPayrollData($source)),
        ];

        foreach ($semesterRecords as $record) {
            if (!is_array($record)) continue;
            $parts = cycleParts($record);
            if (!$parts) continue;
            [$schoolYear, $semester] = $parts;
            $cycleKey = $schoolYear . ':' . $semester;
            $cycles[$cycleKey] = ['school_year' => $schoolYear, 'semester_number' => $semester];
            $payoutType = in_array($record['payout_type'] ?? null, ['initial', 'renewal'], true) ? $record['payout_type'] : 'initial';
            $cycleRecordKey = $studentId . ':' . $cycleKey;
            $cycles['records'][$cycleRecordKey] = [
                'student_id' => $studentId,
                'cycle_key' => $cycleKey,
                'school' => stringValue($source['school_address'] ?? null),
                'course' => stringValue($source['school_course'] ?? null),
                'year_level' => stringValue($source['year_level'] ?? null),
                'batch' => stringValue($source['batch'] ?? null),
                'payout_classification' => $payoutType,
                'requirements' => requirementPayload($record, $source),
            ];
        }
    }

    return ['students' => $students, 'cycles' => $cycles, 'requirements' => $requirements];
}

function makePdo(): PDO
{
    $host = envOrFail('DB_HOST');
    $port = getenv('DB_PORT') ?: '3306';
    $database = envOrFail('DB_DATABASE');
    $username = envOrFail('DB_USERNAME');
    $password = getenv('DB_PASSWORD') ?: '';
    return new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function bootstrapSchema(PDO $pdo): void
{
    logMessage('Preparing migration support schema.');
    // The Laravel migrations remain the canonical schema. This only adds the
    // migration support column/catalog table when the remote database is fresh.
    try { $pdo->exec('ALTER TABLE students ADD COLUMN legacy_data JSON NULL'); } catch (Throwable) {}
    $pdo->exec('CREATE TABLE IF NOT EXISTS sis_options (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        collection_name VARCHAR(50) NOT NULL,
        source_id VARCHAR(191) NOT NULL,
        name VARCHAR(255) NOT NULL,
        added_at TIMESTAMP NULL,
        created_at TIMESTAMP NULL,
        updated_at TIMESTAMP NULL,
        UNIQUE KEY sis_options_source (collection_name, source_id),
        UNIQUE KEY sis_options_name (collection_name, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function bulkUpsert(PDO $pdo, string $table, array $columns, array $rows, array $updateColumns, int $chunkSize = 200): void
{
    if (!$rows) return;
    foreach (array_chunk($rows, $chunkSize) as $chunk) {
        $rowPlaceholder = '(' . implode(',', array_fill(0, count($columns), '?')) . ')';
        $parameters = [];
        foreach ($chunk as $row) foreach ($columns as $column) $parameters[] = $row[$column] ?? null;
        $updates = implode(', ', array_map(fn (string $column) => "{$column}=VALUES({$column})", $updateColumns));
        $sql = "INSERT INTO {$table} (" . implode(',', $columns) . ') VALUES ' . implode(',', array_fill(0, count($chunk), $rowPlaceholder)) . " ON DUPLICATE KEY UPDATE {$updates}";
        $pdo->prepare($sql)->execute($parameters);
    }
}

function importPayload(PDO $pdo, array $payload, array $optionRows): array
{
    logMessage('Starting MySQL transaction.');
    $pdo->beginTransaction();
    try {
        $now = date('Y-m-d H:i:s');
        $students = array_map(fn (array $student) => $student + ['created_at' => $now, 'updated_at' => $now], $payload['students']);
        bulkUpsert($pdo, 'students', ['student_id', 'full_name', 'student_number', 'barangay', 'address', 'phone_number', 'legacy_data', 'created_at', 'updated_at'], $students, ['full_name', 'student_number', 'barangay', 'address', 'phone_number', 'legacy_data', 'updated_at']);
        logMessage('Upserted students in batches: ' . count($students));

        $cycleRows = [];
        foreach ($payload['cycles'] as $key => $cycle) if ($key !== 'records') $cycleRows[] = $cycle + ['status' => 'open', 'created_at' => $now, 'updated_at' => $now];
        bulkUpsert($pdo, 'academic_cycles', ['school_year', 'semester_number', 'status', 'created_at', 'updated_at'], $cycleRows, ['status', 'updated_at']);
        logMessage('Upserted academic cycles in batches: ' . count($cycleRows));

        $studentIds = [];
        foreach ($pdo->query('SELECT id, student_id FROM students') as $row) $studentIds[$row['student_id']] = (int) $row['id'];
        $cycleIds = [];
        foreach ($pdo->query('SELECT id, school_year, semester_number FROM academic_cycles') as $row) $cycleIds[$row['school_year'] . ':' . $row['semester_number']] = (int) $row['id'];

        $studentCycleRows = [];
        foreach ($payload['cycles']['records'] ?? [] as $record) {
            $studentCycleRows[] = [
                'student_id' => $studentIds[$record['student_id']],
                'academic_cycle_id' => $cycleIds[$record['cycle_key']],
                'school' => $record['school'], 'course' => $record['course'], 'year_level' => $record['year_level'],
                'batch' => $record['batch'], 'payout_classification' => $record['payout_classification'],
                'qualification_status' => 'pending', 'created_at' => $now, 'updated_at' => $now,
            ];
        }
        bulkUpsert($pdo, 'student_cycles', ['student_id', 'academic_cycle_id', 'school', 'course', 'year_level', 'batch', 'payout_classification', 'qualification_status', 'created_at', 'updated_at'], $studentCycleRows, ['school', 'course', 'year_level', 'batch', 'payout_classification', 'updated_at']);
        logMessage('Upserted student-cycle records in batches: ' . count($studentCycleRows));

        $studentCycleIds = [];
        $query = $pdo->query('SELECT student_id, academic_cycle_id, id FROM student_cycles');
        foreach ($query as $row) $studentCycleIds[$row['student_id'] . ':' . $row['academic_cycle_id']] = (int) $row['id'];
        $requirementRows = [];
        foreach ($payload['cycles']['records'] ?? [] as $record) {
            $requirementRows[] = ['student_cycle_id' => $studentCycleIds[$studentIds[$record['student_id']] . ':' . $cycleIds[$record['cycle_key']]]] + $record['requirements'] + ['created_at' => $now, 'updated_at' => $now];
        }
        bulkUpsert($pdo, 'student_cycle_requirements', ['student_cycle_id', 'initial_certificate_of_residency', 'initial_pagpapatunay_form', 'initial_picture_of_house', 'initial_good_moral', 'initial_certificate_of_grades', 'initial_proof_of_enrollment', 'renewal_liquidation', 'renewal_proof_of_enrollment', 'renewal_latest_grades', 'created_at', 'updated_at'], $requirementRows, ['initial_certificate_of_residency', 'initial_pagpapatunay_form', 'initial_picture_of_house', 'initial_good_moral', 'initial_certificate_of_grades', 'initial_proof_of_enrollment', 'renewal_liquidation', 'renewal_proof_of_enrollment', 'renewal_latest_grades', 'updated_at']);
        logMessage('Upserted requirement records in batches: ' . count($requirementRows));

        $options = array_map(fn (array $row) => $row + ['created_at' => $now, 'updated_at' => $now], $optionRows);
        bulkUpsert($pdo, 'sis_options', ['collection_name', 'source_id', 'name', 'added_at', 'created_at', 'updated_at'], $options, ['name', 'added_at', 'updated_at']);
        logMessage('Upserted catalog options in batches: ' . count($options));
        $pdo->commit();
        logMessage('MySQL transaction committed.');
        return ['students' => count($students), 'cycles' => count($studentCycleRows), 'requirements' => count($requirementRows), 'options' => count($options)];
    } catch (Throwable $exception) {
        $pdo->rollBack();
        logMessage('MySQL transaction rolled back: ' . $exception->getMessage());
        throw $exception;
    }
}

try {
    logMessage("Migration started; mode=" . ($write ? 'write' : 'dry-run') . ", project={$project}, database={$database}");
    logMessage("Payroll collections and payroll fields are excluded. Log file: {$logFile}");
    $token = googleAccessToken();
    logMessage('Obtained short-lived Google access token. Token value omitted.');
    $students = listCollection($project, $database, 'students', $token);
    $payload = transformStudents($students);
    $optionRows = [];
    foreach (['barangays', 'schools', 'courses', 'batches'] as $collection) {
        $optionRows = array_merge($optionRows, optionRows(listCollection($project, $database, $collection, $token), $collection));
    }

    $summary = ['project' => $project, 'database' => $database, 'students' => count($payload['students']), 'cycles' => count($payload['cycles']['records'] ?? []), 'options' => count($optionRows), 'payroll_records_read' => 0, 'mode' => $write ? 'write' : 'dry-run'];
    if ($exportPath) file_put_contents($exportPath, json_encode(['summary' => $summary, 'payload' => $payload, 'options' => $optionRows], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    if ($exportPath) logMessage("Wrote transformed export: {$exportPath}");
    if ($write) {
        $pdo = makePdo();
        if (array_key_exists('bootstrap-schema', $options)) bootstrapSchema($pdo);
        $summary['imported'] = importPayload($pdo, $payload, $optionRows);
    }
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    logMessage('Migration completed successfully.');
} catch (Throwable $exception) {
    logMessage('Migration failed: ' . $exception->getMessage());
    fwrite(STDERR, "Migration stopped: {$exception->getMessage()}\n");
    exit(1);
}
