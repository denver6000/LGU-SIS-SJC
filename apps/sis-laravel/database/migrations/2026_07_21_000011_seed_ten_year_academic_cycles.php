<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $startYear = now()->year;

        for ($offset = 0; $offset < 10; $offset++) {
            $year = $startYear + $offset;
            $schoolYear = $year.'-'.($year + 1);

            foreach ([1, 2] as $semesterNumber) {
                DB::table('academic_cycles')->insertOrIgnore([
                    'school_year' => $schoolYear,
                    'semester_number' => $semesterNumber,
                    'status' => 'open',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Academic cycles may already be referenced by student records; do not delete them.
    }
};
