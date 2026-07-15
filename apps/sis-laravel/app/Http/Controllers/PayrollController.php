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
        $cycle = $cycles->firstWhere('id', $request->integer('cycle_id')) ?? $cycles->first();
        $type = in_array($request->string('type')->value(), ['initial', 'renewal'], true)
            ? $request->string('type')->value()
            : 'all';

        $qualifiedCycles = StudentCycle::with(['student', 'requirements', 'academicCycle'])
            ->when($cycle, fn ($query) => $query->where('academic_cycle_id', $cycle->id))
            ->where('qualification_status', 'qualified')
            ->when($type !== 'all', fn ($query) => $query->where('payout_classification', $type))
            ->orderBy('id')
            ->get();

        $payrollRows = $qualifiedCycles->filter(fn (StudentCycle $studentCycle) => $studentCycle->isReadyForPayroll());

        return view('payrolls.index', compact('cycles', 'cycle', 'type', 'payrollRows', 'qualifiedCycles'));
    }
}
