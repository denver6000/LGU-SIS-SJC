@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Administration</p><h1>Add user</h1><p class="muted">Create an account for an administrator or encoder.</p></div></div>
<form method="POST" action="{{ route('users.store') }}" class="form-card stack">
    @csrf
    <div class="form-section"><h2>User information</h2><div class="form-grid">
        <label>Name<input name="name" value="{{ old('name') }}" autocomplete="name" required></label>
        <label>Email<input type="email" name="email" value="{{ old('email') }}" autocomplete="email" required></label>
        <label>Password<input type="password" name="password" autocomplete="new-password" required></label>
        <label>Confirm password<input type="password" name="password_confirmation" autocomplete="new-password" required></label>
        <label>Role<select name="role" required><option value="encoder" @selected(old('role', 'encoder') === 'encoder')>Encoder</option><option value="admin" @selected(old('role') === 'admin')>Admin</option></select></label>
    </div></div>
    <div><button class="primary-button" type="submit">Create user</button> <a href="{{ route('users.index') }}">Cancel</a></div>
</form>
@endsection
