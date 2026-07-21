@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Registry</p><h1>Students</h1><p class="muted">Student records and cycle-scoped requirements.</p></div><a class="primary-button" href="{{ route('students.create') }}">Add student</a></div>
<form method="GET" class="timeline-toolbar" role="search">
<label class="search-field">Search students<input type="search" name="search" value="{{ $search }}" placeholder="Name, ID, address, school, or batch"></label>
<button class="secondary-button" type="submit">Search</button>
@if($search !== '')<a href="{{ route('students.index') }}">Clear</a>@endif
</form>
<div class="table-card"><table><thead><tr><th>Student</th><th>Student ID</th><th>Latest cycle</th><th>Qualification</th><th></th></tr></thead><tbody>@forelse($students as $student) @php($cycle = $student->cycles->sortByDesc(fn($item) => $item->academicCycle?->school_year.'-'.$item->academicCycle?->semester_number)->first())<tr><td>{{ $student->full_name }}</td><td>{{ $student->student_id }}</td><td>{{ $cycle?->academicCycle?->label() ?? 'Not set' }}</td><td>{{ ucfirst($cycle?->qualification_status ?? 'pending') }}</td><td><a href="{{ route('students.edit', $student) }}">Manage</a></td></tr>@empty<tr><td colspan="5">No students found.</td></tr>@endforelse</tbody></table></div>
@endsection
