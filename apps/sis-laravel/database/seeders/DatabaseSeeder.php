<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\AcademicCycle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'System Administrator',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'is_active' => true,
            ],
        );

        foreach ([1, 2] as $semester) {
            AcademicCycle::firstOrCreate([
                'school_year' => '2026-2027',
                'semester_number' => $semester,
            ], ['status' => 'open']);
        }
    }
}
