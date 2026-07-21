<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\RequirementsController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\RecordsController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\StudentHistoryController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'create'])->name('login');
    Route::post('/login', [AuthController::class, 'store'])->name('login.store');
});

Route::post('/logout', [AuthController::class, 'destroy'])->middleware('auth')->name('logout');

Route::middleware(['auth', 'role:admin,encoder'])->group(function () {
    Route::get('/', fn () => redirect()->route('students.index'))->name('dashboard');
    Route::get('/students', [StudentController::class, 'index'])->name('students.index');
    Route::get('/students/create', [StudentController::class, 'create'])->name('students.create');
    Route::post('/students', [StudentController::class, 'store'])->name('students.store');
    Route::get('/requirements', [RequirementsController::class, 'index'])->name('requirements.index');
    Route::get('/requirements/students/{student}/edit', [RequirementsController::class, 'edit'])->name('requirements.edit');
    Route::put('/requirements/students/{student}', [RequirementsController::class, 'update'])->name('requirements.update');
    Route::get('/requirements/students/{student}/history', [StudentHistoryController::class, 'index'])->name('requirements.history');
    Route::put('/requirements/{studentCycle}', [RequirementsController::class, 'updateCycle']);
    Route::get('/records', [RecordsController::class, 'index'])->name('records.index');
    Route::post('/records', [RecordsController::class, 'store'])->name('records.store');
    Route::post('/records/cycles', [RecordsController::class, 'storeCycle'])->name('records.cycles.store');
    Route::delete('/records/{sisOption}', [RecordsController::class, 'destroy'])->name('records.destroy');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/students/{student}/edit', [StudentController::class, 'edit'])->name('students.edit');
    Route::put('/students/{student}', [StudentController::class, 'update'])->name('students.update');
    Route::get('/payrolls', [PayrollController::class, 'index'])->name('payrolls.index');
    Route::post('/payrolls/{studentCycle}/mark-payrolled', [PayrollController::class, 'markPayrolled'])->name('payrolls.mark-payrolled');
    Route::get('/activity', [ActivityLogController::class, 'index'])->name('activity.index');
});

Route::middleware(['auth', 'role:admin'])->prefix('users')->name('users.')->group(function () {
    Route::get('/', [UserManagementController::class, 'index'])->name('index');
    Route::get('/create', [UserManagementController::class, 'create'])->name('create');
    Route::post('/', [UserManagementController::class, 'store'])->name('store');
    Route::get('/{user}/edit', [UserManagementController::class, 'edit'])->name('edit');
    Route::put('/{user}', [UserManagementController::class, 'update'])->name('update');
});
