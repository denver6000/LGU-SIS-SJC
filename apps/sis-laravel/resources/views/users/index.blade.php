@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>Users</h1><p class="muted">Admins can create staff accounts and assign encoder or admin access.</p></div><a class="primary-button" href="{{ route('users.create') }}">Add user</a></div>
<div class="table-card"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>@forelse($users as $user)<tr><td>{{ $user->name }}</td><td>{{ $user->email }}</td><td>{{ ucfirst($user->role) }}</td><td>{{ $user->is_active ? 'Active' : 'Inactive' }}</td></tr>@empty<tr><td colspan="4">No users found.</td></tr>@endforelse</tbody></table></div>
@endsection
