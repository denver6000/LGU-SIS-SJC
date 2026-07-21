@extends('layouts.app')
@php($editing = $student->exists)
@section('content')
<div class="page-heading"><div><p class="eyebrow">Registry</p><h1>{{ $editing ? 'Manage student' : 'Add student' }}</h1><p class="muted">Student information and manual qualification are saved for the selected academic cycle.</p></div></div>
<form method="POST" action="{{ $editing ? route('students.update', $student) : route('students.store') }}" class="form-card stack" data-student-form data-auto-cycle="{{ $editing ? 'false' : 'true' }}" data-cycle-preselected="{{ ($editing || old('cycle_id')) ? 'true' : 'false' }}">
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
<label>School year / semester<select name="cycle_id" required data-cycle-select data-edit-url="{{ route('students.edit', $student) }}">
@foreach($cycles as $cycle)<option value="{{ $cycle->id }}" data-school-year="{{ $cycle->school_year }}" data-semester="{{ $cycle->semester_number }}" @selected(old('cycle_id', $selectedCycle?->academic_cycle_id) == $cycle->id)>{{ $cycle->label() }}</option>@endforeach</select></label>
@else
<label>School year / semester<select name="cycle_id" required>
@foreach($cycles as $cycle)<option value="{{ $cycle->id }}" data-school-year="{{ $cycle->school_year }}" data-semester="{{ $cycle->semester_number }}" @selected(old('cycle_id') == $cycle->id)>{{ $cycle->label() }}</option>@endforeach</select>
@if($cycles->isEmpty())<span class="muted">No cycles exist. Add one in <a href="{{ route('records.index') }}">Records Management</a> first.</span>@endif</label>
@endif
<label>School<select name="school"><option value="">Select school</option>@foreach($schools as $school)<option value="{{ $school }}" @selected(old('school', $selectedCycle?->school) === $school)>{{ $school }}</option>@endforeach</select></label>
<label>Course<select name="course"><option value="">Select course</option>@foreach($courses as $course)<option value="{{ $course }}" @selected(old('course', $selectedCycle?->course) === $course)>{{ $course }}</option>@endforeach</select></label>
<label>Year level<input name="year_level" value="{{ old('year_level', $selectedCycle?->year_level) }}"></label>
<label>Batch<select name="batch"><option value="">Select batch</option>@foreach($batches as $batch)<option value="{{ $batch }}" @selected(old('batch', $selectedCycle?->batch) === $batch)>{{ $batch }}</option>@endforeach</select></label>
</div></div>
<div class="form-section"><h2>Requirements</h2><p class="muted">Requirements are managed separately in the Requirements Timeline.</p><a href="{{ route('requirements.index', ['cycle_id' => $selectedCycle?->academic_cycle_id]) }}">Open requirements management</a></div>
<div><button class="primary-button" type="submit">{{ $editing ? 'Save changes' : 'Add student' }}</button> <a href="{{ route('students.index') }}">Cancel</a></div>
</form>
@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-student-form]');
    if (!form) return;

    const cycleSelect = form.querySelector('[name="cycle_id"]');
    const cycleOptions = [...(cycleSelect?.options ?? [])];

    if (cycleSelect && form.dataset.autoCycle === 'true' && form.dataset.cyclePreselected !== 'true') {
        const today = new Date();
        const year = today.getFullYear();
        const semester = today.getMonth() >= 7 ? 1 : 2;
        const schoolYear = semester === 1 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        const suggested = cycleOptions.find((option) => option.dataset.schoolYear === schoolYear && Number(option.dataset.semester) === semester);

        if (suggested) {
            cycleSelect.value = suggested.value;
            const notice = document.createElement('p');
            notice.className = 'muted';
            notice.textContent = `Suggested from today: ${schoolYear}, ${semester === 1 ? '1st' : '2nd'} Semester. Please confirm before saving.`;
            cycleSelect.closest('label')?.append(notice);
        }
    }

    if (cycleSelect?.dataset.editUrl) {
        let previousValue = cycleSelect.value;
        cycleSelect.addEventListener('change', () => {
            const selected = cycleSelect.selectedOptions[0]?.textContent?.trim() || 'the selected academic cycle';
            if (window.confirm(`Switch to ${selected}? Unsaved changes on this page will be discarded.`)) {
                window.location = `${cycleSelect.dataset.editUrl}?cycle_id=${encodeURIComponent(cycleSelect.value)}`;
            } else {
                cycleSelect.value = previousValue;
            }
        });
    }

    form.addEventListener('submit', (event) => {
        if (!form.reportValidity()) {
            event.preventDefault();
            return;
        }

        const selectedCycle = cycleSelect?.selectedOptions[0]?.textContent?.trim() || 'Not selected';
        const payoutTrack = form.querySelector('[name="payout_track"]:checked')?.parentElement?.textContent?.trim() || 'Not selected';
        const studentId = form.querySelector('[name="student_id"]')?.value.trim() || 'Not provided';
        const fullName = form.querySelector('[name="full_name"]')?.value.trim() || 'Not provided';
        const yearLevel = form.querySelector('[name="year_level"]')?.value.trim() || 'Not set';
        const school = form.querySelector('[name="school"]')?.value || 'Not selected';
        const message = [
            'Please confirm this student record:',
            `Name: ${fullName}`,
            `Student ID: ${studentId}`,
            `Academic cycle: ${selectedCycle}`,
            `Year level: ${yearLevel}`,
            `School: ${school}`,
            `Student type: ${payoutTrack}`,
            '',
            'Save this information?'
        ].join('\\n');

        if (!window.confirm(message)) event.preventDefault();
    });
});
</script>
@endpush
@endsection
