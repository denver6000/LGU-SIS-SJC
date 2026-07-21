@extends('layouts.app')
@section('content')
<div class="page-heading">
    <div><p class="eyebrow">Admin only</p><h1>Cycle correction</h1><p class="muted">Merge student records into the correct academic cycle, then remove the mistaken source records.</p></div>
</div>

<section class="form-card stack">
    <form method="GET" action="{{ route('records.cycle-correction') }}" class="form-grid">
        <label>Move from (source cycle)
            <select name="source_cycle_id" required>
                <option value="">Select source cycle</option>
                @foreach($cycles as $cycle)
                    <option value="{{ $cycle->id }}" @selected($source?->id === $cycle->id)>{{ $cycle->label() }}</option>
                @endforeach
            </select>
        </label>
        <label>Move to (target cycle)
            <select name="target_cycle_id" required>
                <option value="">Select target cycle</option>
                @foreach($cycles as $cycle)
                    <option value="{{ $cycle->id }}" @selected($target?->id === $cycle->id)>{{ $cycle->label() }}</option>
                @endforeach
            </select>
        </label>
        <div><button class="primary-button" type="submit">Preview correction</button></div>
    </form>
</section>

@if($source && $target && ! $preview)
    <div class="flash error">Choose two different academic cycles.</div>
@endif

@if($preview)
    <section class="form-section">
        <h2>Preview</h2>
        <p class="muted"><strong>{{ $preview['total'] }}</strong> source record(s) will be processed from <strong>{{ $source->label() }}</strong>. This is a record correction only; it does not create a payroll or mark anyone as paid.</p>
        <div class="payroll-summary">
            <span><strong>{{ $preview['existing_target'] }}</strong> already exist in target</span>
            <span><strong>{{ $preview['missing_target'] }}</strong> will be created</span>
            <span><strong>{{ $preview['qualified'] }}</strong> payroll candidates copied</span>
            <span><strong>{{ $preview['payrolled'] }}</strong> already paid (must be 0)</span>
        </div>

        @if($preview['payrolled'] > 0)
            <div class="flash error">This correction cannot run because at least one source record is already payrolled.</div>
        @elseif($preview['total'] === 0)
            <div class="flash error">The source cycle has no student records.</div>
        @else
            <form method="POST" action="{{ route('records.cycle-correction.merge') }}" class="stack" data-cycle-correction-form>
                @csrf
                <input type="hidden" name="source_cycle_id" value="{{ $source->id }}">
                <input type="hidden" name="target_cycle_id" value="{{ $target->id }}">
                <label class="check"><input type="checkbox" name="confirmation" value="1" required> I reviewed the preview. I understand that this copies records and eligibility data only; it does not mark students as payrolled, and the source records will be removed.</label>
                <button class="primary-button" type="submit">Merge and remove source records</button>
            </form>
        @endif

        <details class="table-card" @if($preview['total'] <= 20) open @endif>
            <summary>Show source students</summary>
            <table><thead><tr><th>Student ID</th><th>Name</th><th>Source record</th><th>Target record</th></tr></thead><tbody>
            @foreach($preview['rows'] as $row)
                @php($targetRow = $preview['target_rows']->get($row->student_id))
                <tr><td>{{ $row->student->student_id }}</td><td>{{ $row->student->full_name }}</td><td>{{ $row->id }}</td><td>{{ $targetRow?->id ?? 'Will be created' }}</td></tr>
            @endforeach
            </tbody></table>
        </details>
    </section>
@endif
@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('[data-cycle-correction-form]')?.addEventListener('submit', (event) => {
        if (!window.confirm('This will merge the reviewed records, preserve payroll eligibility, never mark anyone as paid, and permanently remove the source records. Continue?')) event.preventDefault();
    });
});
</script>
@endpush
@endsection
