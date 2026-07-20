<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    public function index() { return view('users.index', ['users' => User::orderBy('name')->get()]); }

    public function create() { return view('users.create'); }

    public function edit(User $user) { return view('users.edit', compact('user')); }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'in:admin,encoder'],
        ]);

        User::create($data + ['is_active' => true]);
        return redirect()->route('users.index')->with('success', 'User account created.');
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'in:admin,encoder'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->user()->is($user) && ($data['role'] !== 'admin' || ! $request->boolean('is_active', true))) {
            return back()->withErrors(['role' => 'You cannot demote or deactivate your own administrator account.'])->withInput();
        }

        $attributes = collect($data)->except('password')->all();
        if (filled($data['password'] ?? null)) {
            $attributes['password'] = $data['password'];
        }
        $attributes['is_active'] = $request->boolean('is_active');
        $user->update($attributes);

        return redirect()->route('users.index')->with('success', 'User account updated.');
    }
}
