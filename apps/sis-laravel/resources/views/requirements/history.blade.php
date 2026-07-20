@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Student History</p><h1>{{ $student->full_name }}</h1><p class="muted">Read-only history for requirements and academic year-level changes.</p></div><a href="{{ route('requirements.edit', [$student, 'cycle_id' => request('cycle_id', $student->cycles()->latest()->value('academic_cycle_id')), 'tab' => 'all', 'return_tab' => 'all']) }}">Back to manage requirements</a></div>
<div class="timeline-tabs"><a class="{{ $tab === 'requirements' ? 'active' : '' }}" href="{{ route('requirements.history', [$student, 'tab' => 'requirements']) }}">Requirements History</a><a class="{{ $tab === 'year-level' ? 'active' : '' }}" href="{{ route('requirements.history', [$student, 'tab' => 'year-level']) }}">Year Change History</a></div>
<div class="history-list">
@forelse($history as $entry)
<article class="form-section">
    <div class="dialog-history-header"><div><h2>{{ $entry->summary }}</h2><p class="muted">{{ $entry->created_at?->format('Y-m-d H:i:s T') }} · {{ $entry->user?->name ?? 'System' }} · {{ ucfirst($entry->action) }}</p></div><span class="muted">{{ $entry->academicCycle?->label() ?? 'No cycle' }}</span></div>
    @if($tab === 'year-level')
        <p>Year level: <strong>{{ data_get($entry->old_values, 'year_level') ?: 'Not set' }}</strong> → <strong>{{ data_get($entry->new_values, 'year_level') ?: 'Not set' }}</strong></p>
    @else
        @php($old = $entry->old_values ?? []) @php($new = $entry->new_values ?? []) @php($changes = [])
        @if(($old['payout_track'] ?? null) !== ($new['payout_track'] ?? null)) @php($changes['Payout type'] = [ucfirst($old['payout_track'] ?? 'Not set'), ucfirst($new['payout_track'] ?? 'Not set')]) @endif
        @if((bool) ($old['payroll_qualified'] ?? false) !== (bool) ($new['payroll_qualified'] ?? false)) @php($changes['Payroll qualification'] = [($old['payroll_qualified'] ?? false) ? 'Qualified' : 'Not qualified', ($new['payroll_qualified'] ?? false) ? 'Qualified' : 'Not qualified']) @endif
        @foreach(($new['requirements'] ?? []) as $field => $value)
            @if((bool) (($old['requirements'] ?? [])[$field] ?? false) !== (bool) $value) @php($changes[str($field)->replace('_', ' ')->title()->toString()] = [(($old['requirements'] ?? [])[$field] ?? false) ? 'Submitted' : 'Missing', $value ? 'Submitted' : 'Missing']) @endif
        @endforeach
        @if(count($changes))<div class="table-card"><table><thead><tr><th>Item</th><th>Before</th><th>After</th></tr></thead><tbody>@foreach($changes as $label => [$before, $after])<tr><td>{{ $label }}</td><td>{{ $before }}</td><td>{{ $after }}</td></tr>@endforeach</tbody></table></div>@else<p class="muted">Saved without a detected value change.</p>@endif
    @endif
</article>
@empty
<div class="table-card"><p>No {{ $tab === 'requirements' ? 'requirements' : 'year-level' }} history has been recorded yet.</p></div>
@endforelse
</div>
@endsection
