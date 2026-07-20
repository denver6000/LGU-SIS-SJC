<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('student_cycles')->update(['payroll_qualified' => false]);
        DB::table('student_cycle_requirements')->update([
            'renewal_liquidation' => false,
            'renewal_proof_of_enrollment' => false,
            'renewal_latest_grades' => false,
        ]);
    }

    public function down(): void
    {
        // Qualification and submitted-document states are intentionally not restored.
    }
};
