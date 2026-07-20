@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Profile</p><h1>My profile</h1><p class="muted">Update your own account details and password.</p></div></div>
<form method="POST" action="{{ route('profile.update') }}" class="form-card stack">
    @csrf @method('PUT')
    <div class="form-section"><h2>Account information</h2><div class="form-grid">
        <label>Name<input name="name" value="{{ old('name', $user->name) }}" autocomplete="name" required></label>
        <label>Email<input type="email" name="email" value="{{ old('email', $user->email) }}" autocomplete="email" required></label>
    </div></div>
    <div class="form-section"><h2>Change password</h2><div class="form-grid">
        <label>Current password<input type="password" name="current_password" autocomplete="current-password"></label>
        <label>New password<input type="password" name="password" autocomplete="new-password"></label>
        <label>Confirm new password<input type="password" name="password_confirmation" autocomplete="new-password"></label>
    </div><p class="muted">Leave the password fields blank to keep your current password.</p></div>
    <div><button class="primary-button" type="submit">Save profile</button></div>
</form>
@endsection
