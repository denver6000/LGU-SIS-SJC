@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Records Management</p><h1>Barangays and schools</h1><p class="muted">Manage the selectable catalog entries used during student registration.</p></div></div>
<div class="records-grid">
    @foreach(['barangays' => ['Barangays', 'barangay'], 'schools' => ['Schools', 'school'], 'batches' => ['Batches', 'batch']] as $collection => [$title, $singular])
    <section class="table-card record-panel"><div class="record-panel-header"><div><h2>{{ $title }}</h2><p class="muted">{{ ${$collection}->count() }} entries</p></div><form method="POST" action="{{ route('records.store') }}" class="record-add-form">@csrf<input type="hidden" name="collection_name" value="{{ $collection }}"><input name="name" placeholder="Add {{ $singular }}" required><button class="primary-button" type="submit">Add</button></form></div><table><thead><tr><th>Name</th><th></th></tr></thead><tbody>@forelse(${$collection} as $option)<tr><td>{{ $option->name }}</td><td class="record-action"><form method="POST" action="{{ route('records.destroy', $option) }}">@csrf @method('DELETE')<button class="text-button" type="submit" onclick="return confirm('Remove this catalog entry? Existing student values will remain unchanged.')">Remove</button></form></td></tr>@empty<tr><td colspan="2">No {{ $collection }} yet.</td></tr>@endforelse</tbody></table></section>
    @endforeach
</div>
@endsection
