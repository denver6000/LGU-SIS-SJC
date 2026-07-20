<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\RequirementsController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\RecordsController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'create'])->name('login');
    Route::post('/login', [AuthController::class, 'store'])->name('login.store');
});

Route::post('/logout', [AuthController::class, 'destroy'])->middleware('auth')->name('logout');

Route::middleware(['auth', 'role:admin,encoder'])->group(function () {
    Route::get('/', fn () => redirect()->route('students.index'))->name('dashboard');
    Route::resource('students', StudentController::class)->only(['index', 'create', 'store', 'edit', 'update']);
    Route::get('/requirements', [RequirementsController::class, 'index'])->name('requirements.index');
    Route::get('/requirements/students/{student}/edit', [RequirementsController::class, 'edit'])->name('requirements.edit');
    Route::put('/requirements/students/{student}', [RequirementsController::class, 'update'])->name('requirements.update');
    Route::put('/requirements/{studentCycle}', [RequirementsController::class, 'updateCycle']);
    Route::get('/payrolls', [PayrollController::class, 'index'])->name('payrolls.index');
    Route::get('/records', [RecordsController::class, 'index'])->name('records.index');
    Route::post('/records', [RecordsController::class, 'store'])->name('records.store');
    Route::delete('/records/{sisOption}', [RecordsController::class, 'destroy'])->name('records.destroy');
});

Route::middleware(['auth', 'role:admin'])->prefix('users')->name('users.')->group(function () {
    Route::get('/', [UserManagementController::class, 'index'])->name('index');
    Route::get('/create', [UserManagementController::class, 'create'])->name('create');
    Route::post('/', [UserManagementController::class, 'store'])->name('store');
});
