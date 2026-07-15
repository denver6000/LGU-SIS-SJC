@extends('layouts.app')
@php($editing = $student->exists)
@section('content')
<div class="page-heading"><div><p class="eyebrow">Registry</p><h1>{{ $editing ? 'Manage student' : 'Add student' }}</h1><p class="muted">Student information and manual qualification are saved for the selected academic cycle.</p></div></div>
<form method="POST" action="{{ $editing ? route('students.update', $student) : route('students.store') }}" class="form-card stack">
@csrf @if($editing) @method('PUT') @endif
<div class="form-section"><h2>Student information</h2><div class="form-grid">
<label>Student ID<input name="student_id" value="{{ old('student_id', $student->student_id) }}" required></label>
<label>Full name<input name="full_name" value="{{ old('full_name', $student->full_name) }}" required></label>
<label>Student number<input name="student_number" value="{{ old('student_number', $student->student_number) }}"></label>
<label>Phone number<input name="phone_number" value="{{ old('phone_number', $student->phone_number) }}"></label>
<label>Barangay<input name="barangay" value="{{ old('barangay', $student->barangay) }}"></label>
<label>Address<textarea name="address">{{ old('address', $student->address) }}</textarea></label>
</div></div>
<div class="form-section"><h2>Academic cycle</h2><div class="form-grid">
<label>School year / semester<select name="cycle_id" required @if($editing) onchange="window.location='{{ route('students.edit', $student) }}?cycle_id='+this.value" @endif>
@foreach($cycles as $cycle)<option value="{{ $cycle->id }}" @selected(old('cycle_id', $selectedCycle?->academic_cycle_id) == $cycle->id)>{{ $cycle->label() }}</option>@endforeach</select></label>
<label>School<input name="school" value="{{ old('school', $selectedCycle?->school) }}"></label>
<label>Course<input name="course" value="{{ old('course', $selectedCycle?->course) }}"></label>
<label>Year level<input name="year_level" value="{{ old('year_level', $selectedCycle?->year_level) }}"></label>
<label>Batch<input name="batch" value="{{ old('batch', $selectedCycle?->batch) }}"></label>
</div></div>
<div class="form-section"><h2>Requirements</h2><p class="muted">Requirements are managed separately in the Requirements Timeline.</p><a href="{{ route('requirements.index', ['cycle_id' => $selectedCycle?->academic_cycle_id]) }}">Open requirements management</a></div>
<div><button class="primary-button">{{ $editing ? 'Save changes' : 'Add student' }}</button> <a href="{{ route('students.index') }}">Cancel</a></div>
</form>
@endsection
