<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_cycles', function (Blueprint $table) {
            $table->timestamp('payrolled_at')->nullable()->after('payroll_qualified');
            $table->foreignId('payrolled_by')->nullable()->after('payrolled_at')->constrained('users')->nullOnDelete();
            $table->index(['academic_cycle_id', 'payrolled_at']);
        });
    }

    public function down(): void
    {
        Schema::table('student_cycles', function (Blueprint $table) {
            $table->dropForeign(['payrolled_by']);
            $table->dropIndex(['academic_cycle_id', 'payrolled_at']);
            $table->dropColumn(['payrolled_at', 'payrolled_by']);
        });
    }
};
