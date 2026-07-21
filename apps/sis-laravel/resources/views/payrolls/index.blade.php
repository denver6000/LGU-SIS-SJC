@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Payrolls</p><h1>Payroll preparation</h1><p class="muted">Qualified students with complete submitted requirements for the selected cycle.</p></div></div>
<form method="GET" class="timeline-toolbar"><label>School year<select name="school_year" onchange="this.form.submit()">@foreach($schoolYears as $year)<option value="{{ $year }}" @selected($schoolYear === $year)>{{ $year }}</option>@endforeach</select></label><label>Semester<select name="semester_number" onchange="this.form.submit()"><option value="1" @selected($semesterNumber === 1)>1st Semester</option><option value="2" @selected($semesterNumber === 2)>2nd Semester</option></select></label><input type="hidden" name="type" value="{{ $type }}"><input type="hidden" name="status" value="{{ $status }}"></form>
<div class="timeline-tabs"><a class="{{ $type === 'all' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'all']) }}">All payrolls</a><a class="{{ $type === 'initial' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'initial']) }}">Initial payroll</a><a class="{{ $type === 'renewal' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('type') + ['type' => 'renewal']) }}">Renewal payroll</a></div>
<div class="timeline-tabs"><a class="{{ $status === 'ready' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('status') + ['status' => 'ready']) }}">Ready for payroll</a><a class="{{ $status === 'payrolled' ? 'active' : '' }}" href="{{ route('payrolls.index', request()->except('status') + ['status' => 'payrolled']) }}">Payrolled</a></div>
<div class="payroll-summary"><span><strong>{{ $payrollRows->count() }}</strong> {{ $status === 'payrolled' ? 'payrolled' : 'ready for payroll' }}</span></div>
<div class="form-grid payroll-metadata-grid">@if($status === 'ready')<label>Date Of Filing<input type="date" name="date_of_filing"></label><div><button class="secondary-button" type="button" data-payroll-select-all>Select all</button> <button class="primary-button" type="button" data-payroll-export>Create Payroll Files</button></div>@endif</div>
<div class="table-card"><table><thead><tr><th>@if($status === 'ready')<button class="text-button" type="button" data-payroll-select-all>Select all</button>@else Status @endif</th><th>Student</th><th>Student ID</th><th>Payout type</th><th>School</th><th>Requirements</th><th>Payroll state</th></tr></thead><tbody>
@forelse($payrollRows as $studentCycle)
@php $type = $studentCycle->student->payout_track; $progress = $studentCycle->requirementProgress($type); @endphp
<tr><td>@if($status === 'ready')<input type="checkbox" data-payroll-student value="{{ $studentCycle->student->student_id }}">@else<span class="status-pill qualified">Payrolled</span>@endif</td><td>{{ $studentCycle->student->full_name }}</td><td>{{ $studentCycle->student->student_id }}</td><td>{{ ucfirst($type) }}</td><td>{{ $studentCycle->school ?: '—' }}</td><td>{{ $progress['complete'] }}/{{ $progress['total'] }} complete</td><td>@if($status === 'ready')<form method="POST" action="{{ route('payrolls.mark-payrolled', $studentCycle) }}" onsubmit="return confirm('Mark this student as payrolled for {{ $cycle?->label() }}?');">@csrf<input type="hidden" name="type" value="{{ $type }}"><button class="secondary-button compact" type="submit">Mark payrolled</button></form>@else<time datetime="{{ $studentCycle->payrolled_at?->toIso8601String() }}">{{ $studentCycle->payrolled_at?->format('Y-m-d H:i:s T') }}</time><br><span class="muted">{{ $studentCycle->payrolledBy?->name ?? 'Recorded user unavailable' }}</span>@endif</td></tr>
@empty
<tr><td colspan="7">No {{ $status === 'payrolled' ? 'payrolled' : 'ready' }} students for this cycle.</td></tr>
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
