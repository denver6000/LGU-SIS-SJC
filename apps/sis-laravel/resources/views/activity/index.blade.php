@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>Activity log</h1><p class="muted">A read-only record of user actions, timestamps, targets, status codes, and request context.</p></div></div>
<form method="GET" class="timeline-toolbar">
    <label>User<select name="user_id"><option value="">All users</option>@foreach($users as $user)<option value="{{ $user->id }}" @selected((string) request('user_id') === (string) $user->id)>{{ $user->name }} · {{ $user->role }}</option>@endforeach</select></label>
    <label>Action<input name="action" value="{{ request('action') }}" placeholder="Search action"></label>
    <label>From<input type="date" name="from" value="{{ request('from') }}"></label>
    <label>To<input type="date" name="to" value="{{ request('to') }}"></label>
    <button class="primary-button" type="submit">Filter</button>
</form>
<div class="table-card"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Target</th><th>Status</th><th>IP address</th></tr></thead><tbody>
@forelse($logs as $log)
<tr><td><time datetime="{{ $log->created_at?->toIso8601String() }}">{{ $log->created_at?->format('Y-m-d H:i:s T') }}</time></td><td>{{ $log->user?->name ?? 'System / unauthenticated' }}<br><span class="muted">{{ $log->user?->role ?? '—' }}</span></td><td><strong>{{ $log->description }}</strong><br><span class="muted">{{ $log->method }} · {{ $log->route_name ?? $log->route_uri }}</span></td><td>{{ $log->target_type ? class_basename($log->target_type).' #'.$log->target_id : '—' }}</td><td>{{ $log->status_code ?? '—' }}</td><td>{{ $log->ip_address ?? '—' }}</td></tr>
@empty<tr><td colspan="6">No activity recorded.</td></tr>@endforelse
</tbody></table></div>
<div class="pagination-wrap">{{ $logs->links() }}</div>
@endsection
