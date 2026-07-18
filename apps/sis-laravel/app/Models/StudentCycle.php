<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StudentCycle extends Model
{
    public const INITIAL_REQUIREMENTS = [
        'initial_certificate_of_residency', 'initial_pagpapatunay_form', 'initial_picture_of_house',
        'initial_good_moral', 'initial_certificate_of_grades', 'initial_proof_of_enrollment',
    ];

    public const RENEWAL_REQUIREMENTS = [
        'renewal_liquidation', 'renewal_proof_of_enrollment', 'renewal_latest_grades',
    ];

    protected $fillable = [
        'student_id', 'academic_cycle_id', 'school', 'course', 'year_level', 'batch',
        'payroll_qualified', 'qualification_note',
        'qualification_decided_by', 'qualification_decided_at',
    ];

    protected function casts(): array
    {
        return ['payroll_qualified' => 'boolean', 'qualification_decided_at' => 'datetime'];
    }
    public function student(): BelongsTo { return $this->belongsTo(Student::class); }
    public function academicCycle(): BelongsTo { return $this->belongsTo(AcademicCycle::class); }
    public function requirements(): HasOne { return $this->hasOne(StudentCycleRequirement::class); }
    public function decidedBy(): BelongsTo { return $this->belongsTo(User::class, 'qualification_decided_by'); }

    public function requiredRequirementFields(string $type): array
    {
        return $type === 'renewal' ? self::RENEWAL_REQUIREMENTS : self::INITIAL_REQUIREMENTS;
    }

    public function requirementProgress(string $type): array
    {
        $fields = $this->requiredRequirementFields($type);
        $complete = collect($fields)->filter(fn (string $field) => (bool) $this->requirements?->{$field})->count();
        return ['complete' => $complete, 'total' => count($fields)];
    }

    public function isPayrollQualified(): bool
    {
        return $this->payroll_qualified;
    }

    public function isReadyForPayroll(string $type): bool
    {
        $progress = $this->requirementProgress($type);
        return $this->isPayrollQualified() && $progress['complete'] === $progress['total'];
    }
}
