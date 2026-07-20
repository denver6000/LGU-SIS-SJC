<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\StudentCycle;
use App\Models\StudentCycleRequirement;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sis:reset-statuses {--all : Reset every student cycle} {--cycle= : Reset one academic cycle by ID} {--reset-payout-track : Set selected students back to initial payout} {--force : Apply the reset instead of previewing it}', function () {
    if (! $this->option('all') && ! $this->option('cycle')) {
        $this->error('Choose --all or provide --cycle=ID. No data was changed.');
        return 1;
    }

    $cycles = StudentCycle::query()->when($this->option('cycle'), fn ($query) => $query->where('academic_cycle_id', (int) $this->option('cycle')));
    $cycleIds = $cycles->pluck('id');
    $requirementCount = StudentCycleRequirement::whereIn('student_cycle_id', $cycleIds)->count();
    $studentIds = $this->option('all')
        ? Student::query()->pluck('id')
        : StudentCycle::whereIn('id', $cycleIds)->pluck('student_id')->unique();

    $this->info("Selected {$cycleIds->count()} student-cycle record(s) and {$requirementCount} requirement record(s).");
    $this->line('This resets manual qualification, payrolled state, and all requirement checkboxes.');
    $this->line($this->option('reset-payout-track') ? 'Student payout type will also be reset to initial.' : 'Student payout type and history are preserved.');

    if (! $this->option('force')) {
        $this->warn('Dry run only. Re-run with --force to apply this reset.');
        return 0;
    }

    DB::transaction(function () use ($cycleIds, $studentIds): void {
        StudentCycle::whereIn('id', $cycleIds)->update([
            'payroll_qualified' => false,
            'payrolled_at' => null,
            'payrolled_by' => null,
        ]);
        StudentCycleRequirement::whereIn('student_cycle_id', $cycleIds)->update([
            'initial_certificate_of_residency' => false,
            'initial_pagpapatunay_form' => false,
            'initial_picture_of_house' => false,
            'initial_good_moral' => false,
            'initial_certificate_of_grades' => false,
            'initial_proof_of_enrollment' => false,
            'renewal_liquidation' => false,
            'renewal_proof_of_enrollment' => false,
            'renewal_latest_grades' => false,
        ]);
        if ($this->option('reset-payout-track')) {
            Student::whereIn('id', $studentIds)->update(['payout_track' => 'initial']);
        }
    });

    $this->info('Status reset applied. Existing history was preserved.');
})->purpose('Safely reset cycle qualification, requirements, and payrolled state');
