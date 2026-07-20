@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>Manage user</h1><p class="muted">Update account details, role, status, and optionally set a new password.</p></div></div>
<form method="POST" action="{{ route('users.update', $user) }}" class="form-card stack">
    @csrf @method('PUT')
    <div class="form-section"><h2>User information</h2><div class="form-grid">
        <label>Name<input name="name" value="{{ old('name', $user->name) }}" autocomplete="name" required></label>
        <label>Email<input type="email" name="email" value="{{ old('email', $user->email) }}" autocomplete="email" required></label>
        <label>New password<input type="password" name="password" autocomplete="new-password" placeholder="Leave blank to keep current password"></label>
        <label>Confirm new password<input type="password" name="password_confirmation" autocomplete="new-password"></label>
        <label>Role<select name="role" required><option value="encoder" @selected(old('role', $user->role) === 'encoder')>Encoder</option><option value="admin" @selected(old('role', $user->role) === 'admin')>Admin</option></select></label>
        <label class="check"><input type="checkbox" name="is_active" value="1" @checked(old('is_active', $user->is_active))> Active account</label>
    </div></div>
    <div><button class="primary-button" type="submit">Save user</button> <a href="{{ route('users.index') }}">Cancel</a></div>
</form>
@endsection
