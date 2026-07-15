<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Login · {{ config('app.name') }}</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="login-body"><main class="auth-shell"><section class="auth-card">
    <img class="auth-seal" src="{{ asset('assets/pic_sjc_official_seal.jpg') }}" alt="San Jose seal">
    <p class="eyebrow">San Jose LGU</p><h1>Welcome back</h1><p class="muted">Sign in to manage scholarship records.</p>
    <form method="POST" action="{{ route('login.store') }}" class="stack">@csrf
        <label>Email<input type="email" name="email" value="{{ old('email') }}" required autofocus></label>
        <label>Password<input type="password" name="password" required></label>
        <label class="check"><input type="checkbox" name="remember"> Remember me</label>
        @error('email')<p class="field-error">{{ $message }}</p>@enderror
        <button class="primary-button" type="submit">Sign in</button>
    </form>
</section></main></body></html>
