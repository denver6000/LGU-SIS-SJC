# Firestore to MySQL migration

`firestore-to-mysql.php` is intentionally dry-run by default. It reads the
`(default)` Firestore database in `lgus-sjc-scholarship`, normalizes students,
academic-cycle records, requirements, barangays, schools, courses, and batches,
and excludes `payoutRecords`, `operationLogs`, and payroll-related fields.

It uses a short-lived gcloud access token. It does not create or store a service
account key and it does not contain database credentials.

## Before running a write

1. Run Laravel migrations against the new MySQL database so `students`,
   `academic_cycles`, `student_cycles`, and `student_cycle_requirements` exist.
2. Confirm the Hostinger database host, database name, username, password, and
   port. The phpMyAdmin URL is not itself a MySQL connection string.
3. Ask an administrator for a service account with read-only Firestore access
   and permission for the current gcloud user to impersonate it.

## PowerShell dry run

```powershell
$env:GCP_SERVICE_ACCOUNT = "firestore-migration-readonly@lgus-sjc-scholarship.iam.gserviceaccount.com"
php scripts/firestore-to-mysql.php --export=storage/firestore-migration-preview.json
```

Use `--database=staging` only when intentionally inspecting the staging database.

## Explicit write, later

```powershell
$env:DB_HOST = "your-hostinger-mysql-host"
$env:DB_PORT = "3306"
$env:DB_DATABASE = "your_database"
$env:DB_USERNAME = "your_user"
$env:DB_PASSWORD = "your_password"
php scripts/firestore-to-mysql.php --write --bootstrap-schema
```

`--bootstrap-schema` only adds the migration-support `legacy_data` column and
the `sis_options` catalog table. It does not create the core Laravel tables;
those must come from Laravel migrations.
