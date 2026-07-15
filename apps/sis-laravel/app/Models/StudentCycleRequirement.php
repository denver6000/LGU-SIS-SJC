<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentCycleRequirement extends Model
{
    protected $fillable = [
        'initial_certificate_of_residency', 'initial_pagpapatunay_form', 'initial_picture_of_house',
        'initial_good_moral', 'initial_certificate_of_grades', 'initial_proof_of_enrollment',
        'renewal_liquidation', 'renewal_proof_of_enrollment', 'renewal_latest_grades', 'updated_by',
    ];

    protected function casts(): array
    {
        return collect($this->fillable)
            ->filter(fn (string $field) => str_starts_with($field, 'initial_') || str_starts_with($field, 'renewal_'))
            ->mapWithKeys(fn (string $field) => [$field => 'boolean'])
            ->all();
    }

    public function studentCycle(): BelongsTo { return $this->belongsTo(StudentCycle::class); }
}
