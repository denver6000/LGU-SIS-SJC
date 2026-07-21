<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\ActivityLog;
use App\Models\StudentCycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    public function recovery(Request $request)
    {
        [$cycles, $cycle, $schoolYears, $schoolYear, $semesterNumber] = $this->cycleSelection($request);
        $type = in_array($request->string('type')->value(), ['initial', 'renewal'], true) ? $request->string('type')->value() : 'all';
        $search = trim($request->string('search')->value());
        $school = trim($request->string('school')->value());
        $batch = trim($request->string('batch')->value());

        $payrolledRows = StudentCycle::with(['student', 'academicCycle', 'payrolledBy'])
            ->when($cycle, fn ($query) => $query->where('academic_cycle_id', $cycle->id))
            ->whereNotNull('payrolled_at')
            ->when($type !== 'all', fn ($query) => $query->whereHas('student', fn ($students) => $students->where('payout_track', $type)))
            ->when($search !== '', fn ($query) => $query->whereHas('student', fn ($students) => $students
                ->where('full_name', 'like', "%{$search}%")
                ->orWhere('student_id', 'like', "%{$search}%")
                ->orWhere('student_number', 'like', "%{$search}%")
                ->orWhere('address', 'like', "%{$search}%")
                ->orWhere('barangay', 'like', "%{$search}%")))
            ->when($school !== '', fn ($query) => $query->where('school', 'like', "%{$school}%"))
            ->when($batch !== '', fn ($query) => $query->where('batch', 'like', "%{$batch}%"))
            ->orderBy('id')->get();

        return view('payrolls.recovery', compact('cycles', 'cycle', 'schoolYears', 'schoolYear', 'semesterNumber', 'type', 'search', 'school', 'batch', 'payrolledRows'));
    }

    public function revert(Request $request)
    {
        $data = $request->validate([
            'cycle_id' => ['required', 'exists:academic_cycles,id'],
            'student_cycle_ids' => ['required', 'array', 'min:1'],
            'student_cycle_ids.*' => ['integer', 'distinct', 'exists:student_cycles,id'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        $ids = collect($data['student_cycle_ids'])->map(fn ($id) => (int) $id)->unique()->values();
        $rows = StudentCycle::with(['student', 'academicCycle'])
            ->where('academic_cycle_id', $data['cycle_id'])->whereIn('id', $ids)->whereNotNull('payrolled_at')->get();

        if ($rows->count() !== $ids->count()) {
            return back()->withInput()->withErrors(['student_cycle_ids' => 'One or more selected records are no longer payrolled for this cycle. Refresh and try again.']);
        }

        DB::transaction(function () use ($request, $data, $ids, $rows): void {
            StudentCycle::whereIn('id', $ids)->update(['payrolled_at' => null, 'payrolled_by' => null]);
            ActivityLog::record($request, 'payrolls.revert', 'Reverted payroll status for '.$rows->count().' student cycle(s).', [
                'cycle_id' => (int) $data['cycle_id'],
                'student_cycle_ids' => $ids->all(),
                'students' => $rows->map(fn ($row) => ['student_id' => $row->student->student_id, 'full_name' => $row->student->full_name])->values()->all(),
                'reason' => $data['reason'],
            ], 302);
        });

        return redirect()->route('payrolls.recovery', [
            'school_year' => $rows->first()->academicCycle->school_year,
            'semester_number' => $rows->first()->academicCycle->semester_number,
        ])->with('success', $rows->count().' payroll status record(s) reverted.');
    }

    private function cycleSelection(Request $request): array
    {
        $cycles = AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get();
        $selectedCycle = $cycles->firstWhere('id', $request->integer('cycle_id'));
        $schoolYears = $cycles->pluck('school_year')->unique()->values();
        $schoolYear = $request->string('school_year')->value() ?: $selectedCycle?->school_year ?: $schoolYears->first();
        if (! $schoolYears->contains($schoolYear)) $schoolYear = $schoolYears->first();
        $semesterNumber = $request->integer('semester_number') ?: $selectedCycle?->semester_number ?: 1;
        $semesterNumber = in_array($semesterNumber, [1, 2], true) ? $semesterNumber : 1;
        $cycle = $cycles->first(fn ($item) => $item->school_year === $schoolYear && $item->semester_number === $semesterNumber)
            ?? $cycles->firstWhere('school_year', $schoolYear) ?? $cycles->first();
        return [$cycles, $cycle, $schoolYears, $cycle?->school_year, $cycle?->semester_number];
    }
}
