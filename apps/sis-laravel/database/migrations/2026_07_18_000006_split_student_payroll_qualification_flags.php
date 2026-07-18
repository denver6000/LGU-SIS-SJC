<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('payout_track')->default('initial')->after('full_name');
        });
        Schema::table('student_cycles', function (Blueprint $table) {
            $table->boolean('payroll_qualified')->default(false)->after('batch');
        });

        DB::table('students')->whereIn('id', DB::table('student_cycles')->where('payout_classification', 'renewal')->pluck('student_id'))->update(['payout_track' => 'renewal']);
        DB::table('student_cycles')->where('qualification_status', 'qualified')->update(['payroll_qualified' => true]);

        Schema::table('student_cycles', function (Blueprint $table) {
            $table->dropColumn(['payout_classification', 'qualification_status']);
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('payout_track');
        });
        Schema::table('student_cycles', function (Blueprint $table) {
            $table->string('payout_classification')->default('initial');
            $table->string('qualification_status')->default('pending');
        });

        DB::table('student_cycles')->where('payroll_qualified', true)->update(['qualification_status' => 'qualified']);

        Schema::table('student_cycles', function (Blueprint $table) {
            $table->dropColumn('payroll_qualified');
        });
    }
};
