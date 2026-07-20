<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\Student;
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
        $tab = in_array($request->string('tab')->value(), ['all', 'initial', 'renewal'], true) ? $request->string('tab')->value() : 'all';

        $studentCycles = Student::with(['cycles' => fn ($query) => $query
                ->when($cycle, fn ($query) => $query->where('academic_cycle_id', $cycle->id))
                ->with('requirements')])
            ->when($tab === 'initial', fn ($query) => $query->where('payout_track', 'initial'))
            ->when($tab === 'renewal', fn ($query) => $query->where('payout_track', 'renewal'))
            ->when($request->filled('name'), fn ($query) => $query->where('full_name', 'like', '%'.$request->string('name')->value().'%'))
            ->when($request->filled('address'), fn ($query) => $query->where('address', 'like', '%'.$request->string('address')->value().'%'))
            ->when($request->filled('school'), fn ($query) => $query->whereHas('cycles', fn ($cycles) => $cycles->where('academic_cycle_id', $cycle?->id)->where('school', 'like', '%'.$request->string('school')->value().'%')))
            ->when($request->filled('batch'), fn ($query) => $query->whereHas('cycles', fn ($cycles) => $cycles->where('academic_cycle_id', $cycle?->id)->where('batch', 'like', '%'.$request->string('batch')->value().'%')))
            ->when($request->filled('barangay'), fn ($query) => $query->where('barangay', 'like', '%'.$request->string('barangay')->value().'%'))
            ->orderBy('full_name')
            ->get();

        return view('requirements.index', compact('cycles', 'cycle', 'tab', 'studentCycles'));
    }

    public function edit(Student $student, Request $request)
    {
        $cycle = AcademicCycle::findOrFail($request->integer('cycle_id'));
        $studentCycle = $student->cycles()->with(['student', 'academicCycle', 'requirements'])
            ->where('academic_cycle_id', $cycle->id)->first();

        if (! $studentCycle) {
            $studentCycle = new StudentCycle(['student_id' => $student->id, 'academic_cycle_id' => $cycle->id]);
            $studentCycle->setRelation('student', $student);
            $studentCycle->setRelation('academicCycle', $cycle);
        }

        $requestedTab = $request->string('tab')->value();
        $tab = $requestedTab === 'renewal' ? 'renewal' : ($requestedTab === 'all' ? $studentCycle->student->payout_track : 'initial');
        $fields = $tab === 'renewal' ? self::RENEWAL_FIELDS : self::INITIAL_FIELDS;
        $initialFields = self::INITIAL_FIELDS;
        $renewalFields = self::RENEWAL_FIELDS;

        return view('requirements.form', compact('studentCycle', 'tab', 'fields', 'initialFields', 'renewalFields'));
    }

    public function update(Request $request, Student $student)
    {
        $cycleData = $request->validate(['cycle_id' => ['required', 'exists:academic_cycles,id']]);
        $studentCycle = $student->cycles()->firstOrCreate(['academic_cycle_id' => $cycleData['cycle_id']]);
        return $this->saveUpdate($request, $studentCycle);
    }

    public function updateCycle(Request $request, StudentCycle $studentCycle)
    {
        return $this->saveUpdate($request, $studentCycle);
    }

    private function saveUpdate(Request $request, StudentCycle $studentCycle)
    {
        $studentCycle->loadMissing('student');
        $payoutTrack = $request->input('payout_track', $studentCycle->student->payout_track);
        $request->merge(['payout_track' => $payoutTrack]);
        $data = $request->validate(array_merge(
            ['payout_track' => ['required', 'in:initial,renewal']],
            ['payroll_qualified' => ['nullable', 'boolean']],
            ['qualification_note' => ['nullable', 'string']],
            collect(self::INITIAL_FIELDS + self::RENEWAL_FIELDS)->mapWithKeys(fn ($label, $field) => [$field => ['nullable', 'boolean']])->all(),
        ));
        $payoutTrack = $data['payout_track'];
        $fields = $payoutTrack === 'renewal' ? self::RENEWAL_FIELDS : self::INITIAL_FIELDS;
        $studentCycle->student->update(['payout_track' => $payoutTrack]);
        $studentCycle->update([
            'payroll_qualified' => $request->boolean('payroll_qualified'),
            'qualification_note' => $data['qualification_note'] ?? null,
            'qualification_decided_by' => $request->user()->id,
            'qualification_decided_at' => now(),
        ]);
        $studentCycle->requirements()->updateOrCreate([], collect($fields)->mapWithKeys(fn ($label, $field) => [$field => (bool) ($data[$field] ?? false)])->merge(['updated_by' => $request->user()->id])->all());

        return redirect()->route('requirements.index', ['cycle_id' => $studentCycle->academic_cycle_id, 'tab' => $request->string('return_tab')->value() ?: 'all'])->with('success', 'Requirements updated.');
    }
}
