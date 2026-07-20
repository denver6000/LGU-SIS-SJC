<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function edit(Request $request)
    {
        return view('profile.edit', ['user' => $request->user()]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$request->user()->id],
            'current_password' => ['required_with:password', 'current_password'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $attributes = ['name' => $data['name'], 'email' => $data['email']];
        if (filled($data['password'] ?? null)) {
            $attributes['password'] = $data['password'];
        }
        $request->user()->update($attributes);

        return back()->with('success', 'Profile updated.');
    }
}
