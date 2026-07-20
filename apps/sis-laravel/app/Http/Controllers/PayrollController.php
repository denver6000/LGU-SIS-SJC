<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\StudentCycle;
use Illuminate\Http\Request;

class PayrollController extends Controller
{
    public function index(Request $request)
    {
        $cycles = AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get();
        $selectedCycle = $cycles->firstWhere('id', $request->integer('cycle_id'));
        $schoolYears = $cycles->pluck('school_year')->unique()->values();
        $schoolYear = $request->string('school_year')->value() ?: $selectedCycle?->school_year ?: $schoolYears->first();
        if (! $schoolYears->contains($schoolYear)) {
            $schoolYear = $schoolYears->first();
        }
        $semesterNumber = $request->integer('semester_number') ?: $selectedCycle?->semester_number ?: 1;
        $semesterNumber = in_array($semesterNumber, [1, 2], true) ? $semesterNumber : 1;
        $cycle = $cycles->first(fn ($item) => $item->school_year === $schoolYear && $item->semester_number === $semesterNumber)
            ?? $cycles->firstWhere('school_year', $schoolYear)
            ?? $cycles->first();
        $schoolYear = $cycle?->school_year;
        $semesterNumber = $cycle?->semester_number;
        $type = in_array($request->string('type')->value(), ['initial', 'renewal'], true)
            ? $request->string('type')->value()
            : 'all';
        $status = $request->string('status')->value() === 'payrolled' ? 'payrolled' : 'ready';

        $qualifiedCycles = StudentCycle::with(['student', 'requirements', 'academicCycle', 'payrolledBy'])
            ->when($cycle, fn ($query) => $query->where('academic_cycle_id', $cycle->id))
            ->where('payroll_qualified', true)
            ->when($type !== 'all', fn ($query) => $query->whereHas('student', fn ($students) => $students->where('payout_track', $type)))
            ->orderBy('id')
            ->get();

        $payrollRows = $qualifiedCycles
            ->filter(fn (StudentCycle $studentCycle) => $studentCycle->isReadyForPayroll($studentCycle->student->payout_track))
            ->filter(fn (StudentCycle $studentCycle) => $status === 'payrolled' ? $studentCycle->isPayrolled() : ! $studentCycle->isPayrolled());

        return view('payrolls.index', compact('cycles', 'cycle', 'type', 'status', 'schoolYears', 'schoolYear', 'semesterNumber', 'payrollRows', 'qualifiedCycles'));
    }

    public function markPayrolled(Request $request, StudentCycle $studentCycle)
    {
        $studentCycle->load(['student', 'academicCycle']);
        abort_if($studentCycle->isPayrolled(), 409, 'This student is already marked payrolled for this academic cycle.');
        abort_unless($studentCycle->isReadyForPayroll($studentCycle->student->payout_track), 422, 'This student is not ready for payroll.');

        $studentCycle->update(['payrolled_at' => now(), 'payrolled_by' => $request->user()->id]);

        return redirect()->route('payrolls.index', [
            'school_year' => $studentCycle->academicCycle->school_year,
            'semester_number' => $studentCycle->academicCycle->semester_number,
            'type' => $request->string('type')->value() ?: 'all',
            'status' => 'ready',
        ])->with('success', $studentCycle->student->full_name.' marked as payrolled for '.$studentCycle->academicCycle->label().'.');
    }
}
