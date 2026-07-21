@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Admin only · Payroll recovery</p><h1>Revert payroll status</h1><p class="muted">Use only for corrections or emergencies. This clears the payrolled marker for the selected year-semester without changing requirements, qualification, payout type, or student data.</p></div><a href="{{ route('payrolls.index') }}">Back to payroll preparation</a></div>
<form method="GET" class="timeline-toolbar">
<label>School year<select name="school_year" onchange="this.form.submit()">@foreach($schoolYears as $year)<option value="{{ $year }}" @selected($schoolYear === $year)>{{ $year }}</option>@endforeach</select></label>
<label>Semester<select name="semester_number" onchange="this.form.submit()"><option value="1" @selected($semesterNumber === 1)>1st Semester</option><option value="2" @selected($semesterNumber === 2)>2nd Semester</option></select></label>
<label>Payout type<select name="type"><option value="all" @selected($type === 'all')>All</option><option value="initial" @selected($type === 'initial')>Initial</option><option value="renewal" @selected($type === 'renewal')>Renewal</option></select></label>
<label>Search name, ID, address, or barangay<input name="search" value="{{ $search }}" placeholder="Search students"></label>
<label>School<input name="school" value="{{ $school }}" placeholder="Filter school"></label>
<label>Batch<input name="batch" value="{{ $batch }}" placeholder="Filter batch"></label>
<button class="primary-button" type="submit">Filter</button>
</form>
<div class="flash" role="note"><strong>Emergency control:</strong> selected records will return to payroll review and the action will be recorded with your reason.</div>
<form method="POST" action="{{ route('payrolls.recovery.revert') }}" class="stack" data-payroll-recovery-form>
@csrf<input type="hidden" name="cycle_id" value="{{ $cycle?->id }}">
<div class="form-grid"><label>Reason for reversal<textarea name="reason" required minlength="5" maxlength="1000" placeholder="Explain why this payroll status must be reverted.">{{ old('reason') }}</textarea></label><div><p class="muted">Selected cycle: <strong>{{ $cycle?->label() ?? 'No academic cycle' }}</strong></p><button class="secondary-button" type="button" data-recovery-select-all>Select all</button> <button class="primary-button" type="submit">Revert selected statuses</button></div></div>
<div class="table-card"><table><thead><tr><th><button class="text-button" type="button" data-recovery-select-all>Select all</button></th><th>Student</th><th>Student ID</th><th>Payout type</th><th>School</th><th>Batch</th><th>Payrolled at</th><th>Recorded by</th></tr></thead><tbody>
@forelse($payrolledRows as $row)<tr><td><input type="checkbox" name="student_cycle_ids[]" value="{{ $row->id }}" data-recovery-row></td><td>{{ $row->student->full_name }}</td><td>{{ $row->student->student_id }}</td><td>{{ ucfirst($row->student->payout_track) }}</td><td>{{ $row->school ?: '—' }}</td><td>{{ $row->batch ?: '—' }}</td><td>{{ $row->payrolled_at?->format('Y-m-d H:i:s T') }}</td><td>{{ $row->payrolledBy?->name ?? 'Unavailable' }}</td></tr>
@empty<tr><td colspan="8">No payrolled records match the selected filters.</td></tr>@endforelse
</tbody></table></div>
</form>
@endsection
