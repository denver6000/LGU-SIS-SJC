@extends('layouts.app')
@php($editing = $student->exists)
@section('content')
<div class="page-heading"><div><p class="eyebrow">Registry</p><h1>{{ $editing ? 'Manage student' : 'Add student' }}</h1><p class="muted">Student information and manual qualification are saved for the selected academic cycle.</p></div></div>
<form method="POST" action="{{ $editing ? route('students.update', $student) : route('students.store') }}" class="form-card stack">
@csrf @if($editing) @method('PUT') @endif
<div class="form-section"><h2>Student information</h2><div class="form-grid">
<label>Student ID<input name="student_id" value="{{ old('student_id', $student->student_id) }}" required></label>
<label>Full name<input name="full_name" value="{{ old('full_name', $student->full_name) }}" required></label>
<div class="toggle-field"><span class="field-label">Student type</span><div class="segmented-control" role="radiogroup" aria-label="Student type"><label><input type="radio" name="payout_track" value="initial" @checked(old('payout_track', $student->payout_track ?: 'initial') === 'initial')> New student</label><label><input type="radio" name="payout_track" value="renewal" @checked(old('payout_track', $student->payout_track) === 'renewal')> For renewal</label></div></div>
<label>Student number<input name="student_number" value="{{ old('student_number', $student->student_number) }}"></label>
<label>Phone number<input name="phone_number" value="{{ old('phone_number', $student->phone_number) }}"></label>
<label>Barangay<select name="barangay"><option value="">Select barangay</option>@foreach($barangays as $barangay)<option value="{{ $barangay }}" @selected(old('barangay', $student->barangay) === $barangay)>{{ $barangay }}</option>@endforeach</select></label>
<label>Address<textarea name="address">{{ old('address', $student->address) }}</textarea></label>
</div></div>
<div class="form-section"><h2>Academic cycle</h2><div class="form-grid">
@if($editing)
<label>School year / semester<select name="cycle_id" required onchange="window.location='{{ route('students.edit', $student) }}?cycle_id='+this.value">
@foreach($cycles as $cycle)<option value="{{ $cycle->id }}" @selected(old('cycle_id', $selectedCycle?->academic_cycle_id) == $cycle->id)>{{ $cycle->label() }}</option>@endforeach</select></label>
@else
<label>School year<input name="school_year" value="{{ old('school_year') }}" placeholder="2026-2027" pattern="\d{4}-\d{4}" title="Use the format YYYY-YYYY" required></label>
<label>Semester<select name="semester_number" required><option value="1" @selected(old('semester_number') == '1')>1st Semester</option><option value="2" @selected(old('semester_number') == '2')>2nd Semester</option></select></label>
@endif
<label>School<select name="school"><option value="">Select school</option>@foreach($schools as $school)<option value="{{ $school }}" @selected(old('school', $selectedCycle?->school) === $school)>{{ $school }}</option>@endforeach</select></label>
<label>Course<select name="course"><option value="">Select course</option>@foreach($courses as $course)<option value="{{ $course }}" @selected(old('course', $selectedCycle?->course) === $course)>{{ $course }}</option>@endforeach</select></label>
<label>Year level<input name="year_level" value="{{ old('year_level', $selectedCycle?->year_level) }}"></label>
<label>Batch<select name="batch"><option value="">Select batch</option>@foreach($batches as $batch)<option value="{{ $batch }}" @selected(old('batch', $selectedCycle?->batch) === $batch)>{{ $batch }}</option>@endforeach</select></label>
</div></div>
<div class="form-section"><h2>Requirements</h2><p class="muted">Requirements are managed separately in the Requirements Timeline.</p><a href="{{ route('requirements.index', ['cycle_id' => $selectedCycle?->academic_cycle_id]) }}">Open requirements management</a></div>
<div><button class="primary-button">{{ $editing ? 'Save changes' : 'Add student' }}</button> <a href="{{ route('students.index') }}">Cancel</a></div>
</form>
@endsection
