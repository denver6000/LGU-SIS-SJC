<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'Students' }} · {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="workspace-body">
    <div class="workspace-shell">
        <div class="rail-backdrop" data-rail-backdrop></div>
        <aside class="workspace-rail" data-rail>
            <div class="rail-brand">
                <img src="{{ asset('assets/pic_sjc_official_seal.jpg') }}" alt="San Jose seal">
                <div><strong>San Jose LGU</strong><span>Scholarship Management System</span></div>
                <button class="rail-close" type="button" data-rail-close aria-label="Close navigation">×</button>
            </div>
            <div class="rail-user">
                <div class="avatar">{{ strtoupper(substr(auth()->user()->name, 0, 1)) }}</div>
                <div><strong>{{ auth()->user()->name }}</strong><span>{{ ucfirst(auth()->user()->role) }}</span></div>
            </div>
            <nav class="rail-nav" aria-label="Main navigation">
                <a class="{{ request()->routeIs('students.*', 'dashboard') ? 'active' : '' }}" href="{{ route('students.index') }}"><span>▦</span> Students</a>
                <a class="{{ request()->routeIs('requirements.*') ? 'active' : '' }}" href="{{ route('requirements.index') }}"><span>☷</span> Requirements</a>
                @if(auth()->user()->isAdmin())
                    <a class="{{ request()->routeIs('payrolls.*') ? 'active' : '' }}" href="{{ route('payrolls.index') }}"><span>₱</span> Payrolls</a>
                @endif
                <a class="{{ request()->routeIs('records.*') ? 'active' : '' }}" href="{{ route('records.index') }}"><span>▤</span> Records</a>
                @if(auth()->user()->isAdmin())
                    <a class="{{ request()->routeIs('users.*') ? 'active' : '' }}" href="{{ route('users.index') }}"><span>♙</span> Users</a>
                @endif
            </nav>
            <div class="rail-program"><img src="{{ asset('assets/logo_with_mayor_name.jpg') }}" alt="Scholarship program"><span>Scholarship Program</span></div>
            <form class="rail-signout" method="POST" action="{{ route('logout') }}">@csrf<button type="submit">↪ <span>Log out</span></button></form>
        </aside>
        <main class="workspace-main">
            <header class="workspace-header">
                <button class="menu-button" type="button" data-rail-toggle aria-label="Open navigation">☰</button>
                <div><p class="header-eyebrow">Scholarship Management System</p><h2>{{ $title ?? 'Students' }}</h2></div>
                <img class="header-logo" src="{{ asset('assets/pic_sjc_official_seal.jpg') }}" alt="San Jose seal">
            </header>
            <div class="workspace-content">
                @if(session('success')) <div class="flash success">{{ session('success') }}</div> @endif
                @if($errors->any()) <div class="flash error"><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div> @endif
                @yield('content')
            </div>
        </main>
    </div>
</body>
</html>
