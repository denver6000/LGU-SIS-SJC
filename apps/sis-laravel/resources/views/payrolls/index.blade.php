@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Payrolls</p><h1>Payroll preparation</h1><p class="muted">Qualified students with complete submitted requirements for the selected cycle.</p></div></div>
<form method="GET" class="timeline-toolbar"><label>School year / semester<select name="cycle_id" onchange="this.form.submit()">@foreach($cycles as $item)<option value="{{ $item->id }}" @selected($cycle?->id === $item->id)>{{ $item->label() }}</option>@endforeach</select></label></form>
<div class="timeline-tabs"><a class="{{ $type === 'all' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'all']) }}">All payrolls</a><a class="{{ $type === 'initial' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'initial']) }}">Initial payroll</a><a class="{{ $type === 'renewal' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'renewal']) }}">Renewal payroll</a></div>
<div class="payroll-summary"><span><strong>{{ $payrollRows->count() }}</strong> ready for payroll</span><span><strong>{{ $qualifiedCycles->count() }}</strong> manually qualified</span></div>
<div class="form-grid payroll-metadata-grid"><label>Date Of Filing<input type="date" name="date_of_filing"></label><div><button class="primary-button" type="button" data-payroll-export>Create Payroll Files</button></div></div>
<div class="table-card"><table><thead><tr><th>Select</th><th>Student</th><th>Student ID</th><th>Payout type</th><th>School</th><th>Requirements</th><th>Qualification</th></tr></thead><tbody>
@forelse($payrollRows as $studentCycle)
@php $type = $studentCycle->student->payout_track; $progress = $studentCycle->requirementProgress($type); @endphp
<tr><td><input type="checkbox" data-payroll-student value="{{ $studentCycle->student->student_id }}"></td><td>{{ $studentCycle->student->full_name }}</td><td>{{ $studentCycle->student->student_id }}</td><td>{{ ucfirst($type) }}</td><td>{{ $studentCycle->school ?: '—' }}</td><td>{{ $progress['complete'] }}/{{ $progress['total'] }} complete</td><td><span class="status-pill qualified">Qualified</span></td></tr>
@empty
<tr><td colspan="7">No qualified students with complete requirements for this cycle.</td></tr>
@endforelse
</tbody></table></div>
@php
    $exportRows = $payrollRows->map(function ($studentCycle) {
        return [
            'student_id' => $studentCycle->student->student_id,
            'full_name' => $studentCycle->student->full_name,
            'student_number' => $studentCycle->student->student_number,
            'barangay' => $studentCycle->student->barangay,
            'address' => $studentCycle->student->address,
            'phone_number' => $studentCycle->student->phone_number,
            'school_address' => $studentCycle->school,
            'school_course' => $studentCycle->course,
            'year_level' => $studentCycle->year_level,
            'batch' => $studentCycle->batch,
            'status' => 'qualified',
            'renewed' => $studentCycle->student->payout_track === 'renewal',
            'claimed' => false,
        ];
    })->values();
@endphp
<script id="payroll-export-data" data-school-year="{{ $cycle?->school_year }}" data-sem-number="{{ $cycle?->semester_number }}" type="application/json">@json($exportRows)</script>
@endsection
