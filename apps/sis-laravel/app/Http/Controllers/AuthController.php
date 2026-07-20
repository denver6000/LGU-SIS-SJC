<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function create()
    {
        return view('auth.login');
    }

    public function store(Request $request)
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            ActivityLog::record($request, 'auth.login.failed', 'Failed login attempt', ['email' => $request->string('email')->value()], 422);
            return back()->withErrors(['email' => 'Those credentials were not accepted.'])->onlyInput('email');
        }

        if (! $request->user()->is_active) {
            ActivityLog::record($request, 'auth.login.inactive', 'Login blocked for inactive account', ['email' => $request->user()->email], 403);
            Auth::logout();
            return back()->withErrors(['email' => 'This account is inactive.'])->onlyInput('email');
        }

        $request->session()->regenerate();
        ActivityLog::record($request, 'auth.login', 'User signed in', null, 302);
        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request)
    {
        ActivityLog::record($request, 'auth.logout', 'User signed out', null, 302);
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }
}
