<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\StudentCycle;
use Illuminate\Http\Request;

class RequirementsController extends Controller
{
    private const INITIAL_FIELDS = [
        'initial_certificate_of_residency' => 'Certificate of residency',
        'initial_pagpapatunay_form' => 'Pagpapatunay form',
        'initial_picture_of_house' => 'Picture of house',
        'initial_good_moral' => 'Good moral certificate',
        'initial_certificate_of_grades' => 'Certificate of grades',
        'initial_proof_of_enrollment' => 'Proof of enrollment',
    ];

    private const RENEWAL_FIELDS = [
        'renewal_liquidation' => 'Liquidation',
        'renewal_proof_of_enrollment' => 'Proof of enrollment',
        'renewal_latest_grades' => 'Latest grades',
    ];

    public function index(Request $request)
    {
        $cycles = AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get();
        $cycle = $cycles->firstWhere('id', $request->integer('cycle_id')) ?? $cycles->first();
        $tab = $request->string('tab')->value() === 'renewal' ? 'renewal' : 'initial';

        $studentCycles = StudentCycle::with(['student', 'requirements', 'academicCycle'])
            ->when($cycle, fn ($query) => $query->where('academic_cycle_id', $cycle->id))
            ->where('payout_classification', $tab)
            ->when($request->filled('name'), fn ($query) => $query->whereHas('student', fn ($students) => $students->where('full_name', 'like', '%'.$request->string('name')->value().'%')))
            ->when($request->filled('barangay'), fn ($query) => $query->whereHas('student', fn ($students) => $students->where('barangay', 'like', '%'.$request->string('barangay')->value().'%')))
            ->get();

        return view('requirements.index', compact('cycles', 'cycle', 'tab', 'studentCycles'));
    }

    public function edit(StudentCycle $studentCycle, Request $request)
    {
        $studentCycle->load(['student', 'academicCycle', 'requirements']);
        $tab = $request->string('tab')->value() === 'renewal' ? 'renewal' : 'initial';
        $fields = $tab === 'renewal' ? self::RENEWAL_FIELDS : self::INITIAL_FIELDS;

        return view('requirements.form', compact('studentCycle', 'tab', 'fields'));
    }

    public function update(Request $request, StudentCycle $studentCycle)
    {
        $tab = $request->string('tab')->value() === 'renewal' ? 'renewal' : 'initial';
        $fields = $tab === 'renewal' ? self::RENEWAL_FIELDS : self::INITIAL_FIELDS;
        $data = $request->validate(array_merge(
            ['payout_classification' => ['required', 'in:initial,renewal']],
            ['qualification_status' => ['required', 'in:pending,qualified,excluded'], 'qualification_note' => ['nullable', 'string']],
            collect($fields)->mapWithKeys(fn ($label, $field) => [$field => ['nullable', 'boolean']])->all(),
        ));
        $studentCycle->update([
            'payout_classification' => $data['payout_classification'],
            'qualification_status' => $data['qualification_status'],
            'qualification_note' => $data['qualification_note'] ?? null,
            'qualification_decided_by' => $request->user()->id,
            'qualification_decided_at' => now(),
        ]);
        $studentCycle->requirements()->updateOrCreate([], collect($fields)->mapWithKeys(fn ($label, $field) => [$field => (bool) ($data[$field] ?? false)])->merge(['updated_by' => $request->user()->id])->all());

        return redirect()->route('requirements.index', ['cycle_id' => $studentCycle->academic_cycle_id, 'tab' => $data['payout_classification']])->with('success', 'Requirements updated.');
    }
}
