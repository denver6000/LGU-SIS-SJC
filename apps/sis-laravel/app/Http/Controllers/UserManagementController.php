<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    public function index() { return view('users.index', ['users' => User::orderBy('name')->get()]); }

    public function create() { return view('users.create'); }

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
}
