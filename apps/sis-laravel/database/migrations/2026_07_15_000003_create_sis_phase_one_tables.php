<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('student_id')->unique();
            $table->string('full_name');
            $table->string('student_number')->nullable();
            $table->string('barangay')->nullable();
            $table->text('address')->nullable();
            $table->string('phone_number')->nullable();
            $table->timestamps();
        });

        Schema::create('academic_cycles', function (Blueprint $table) {
            $table->id();
            $table->string('school_year');
            $table->unsignedTinyInteger('semester_number');
            $table->string('status')->default('open');
            $table->timestamps();
            $table->unique(['school_year', 'semester_number']);
        });

        Schema::create('student_cycles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_cycle_id')->constrained()->cascadeOnDelete();
            $table->string('school')->nullable();
            $table->string('course')->nullable();
            $table->string('year_level')->nullable();
            $table->string('batch')->nullable();
            $table->string('payout_classification')->default('initial');
            $table->string('qualification_status')->default('pending');
            $table->text('qualification_note')->nullable();
            $table->foreignId('qualification_decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('qualification_decided_at')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'academic_cycle_id']);
        });

        Schema::create('student_cycle_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_cycle_id')->constrained()->cascadeOnDelete();
            $table->boolean('initial_certificate_of_residency')->default(false);
            $table->boolean('initial_pagpapatunay_form')->default(false);
            $table->boolean('initial_picture_of_house')->default(false);
            $table->boolean('initial_good_moral')->default(false);
            $table->boolean('initial_certificate_of_grades')->default(false);
            $table->boolean('initial_proof_of_enrollment')->default(false);
            $table->boolean('renewal_liquidation')->default(false);
            $table->boolean('renewal_proof_of_enrollment')->default(false);
            $table->boolean('renewal_latest_grades')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique('student_cycle_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_cycle_requirements');
        Schema::dropIfExists('student_cycles');
        Schema::dropIfExists('academic_cycles');
        Schema::dropIfExists('students');
    }
};
