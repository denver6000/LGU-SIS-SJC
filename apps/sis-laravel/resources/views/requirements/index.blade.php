@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Requirements</p><h1>Requirements Timeline</h1><p class="muted">Manage requirements independently from student registration.</p></div></div>
<form method="GET" class="timeline-toolbar">
    <label>School year / semester<select name="cycle_id" onchange="this.form.submit()">@foreach($cycles as $item)<option value="{{ $item->id }}" @selected($cycle?->id === $item->id)>{{ $item->label() }}</option>@endforeach</select></label>
    <label>Student name<input name="name" value="{{ request('name') }}" placeholder="Search name"></label>
    <label>Address<input name="address" value="{{ request('address') }}" placeholder="Search address"></label>
    <label>School<input name="school" value="{{ request('school') }}" placeholder="Search school"></label>
    <label>Batch<input name="batch" value="{{ request('batch') }}" placeholder="Search batch"></label>
    <label>Barangay<input name="barangay" value="{{ request('barangay') }}" placeholder="Search barangay"></label>
    <input type="hidden" name="tab" value="{{ $tab }}"><button class="primary-button" type="submit">Filter</button>
</form>
<div class="timeline-tabs"><a class="{{ $tab === 'all' ? 'active' : '' }}" href="{{ route('requirements.index', request()->except('tab') + ['tab' => 'all']) }}">All students</a><a class="{{ $tab === 'initial' ? 'active' : '' }}" href="{{ route('requirements.index', request()->except('tab') + ['tab' => 'initial']) }}">Initial payout</a><a class="{{ $tab === 'renewal' ? 'active' : '' }}" href="{{ route('requirements.index', request()->except('tab') + ['tab' => 'renewal']) }}">Renewal payout</a></div>
<div class="table-card"><table><thead><tr><th>Student</th><th>Student ID</th><th>Payout type</th><th>School</th><th>Requirement progress</th><th>Qualification</th><th></th></tr></thead><tbody>
@forelse($studentCycles as $student)
@php($studentCycle = $student->cycles->first()) @php($type = $student->payout_track) @php($progress = $studentCycle?->requirementProgress($type) ?? ['complete' => 0, 'total' => $type === 'renewal' ? count(\App\Models\StudentCycle::RENEWAL_REQUIREMENTS) : count(\App\Models\StudentCycle::INITIAL_REQUIREMENTS)])
<tr><td>{{ $student->full_name }}</td><td>{{ $student->student_id }}</td><td>{{ ucfirst($type) }}</td><td>{{ $studentCycle?->school ?: '—' }}</td><td>{{ $progress['complete'] }}/{{ $progress['total'] }}</td><td>{{ $studentCycle?->payroll_qualified ? 'Qualified' : 'Not qualified' }}</td><td>@if($tab === 'all')<a href="{{ route('requirements.edit', [$student, 'cycle_id' => $cycle?->id, 'tab' => $tab, 'return_tab' => $tab]) }}">Manage requirements</a>@else<span class="muted">View only</span>@endif</td></tr>
@empty<tr><td colspan="7">No students found for this cycle.</td></tr>@endforelse
</tbody></table></div>
@endsection
