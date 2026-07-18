<?php

namespace Tests\Feature;

use App\Models\AcademicCycle;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic test example.
     */
    public function test_guests_are_sent_to_login(): void
    {
        $response = $this->get('/');

        $response->assertRedirectToRoute('login');
    }

    public function test_admin_can_login_and_reach_students(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true, 'password' => 'password']);

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirectToRoute('dashboard');
    }

    public function test_encoder_cannot_manage_users(): void
    {
        $user = User::factory()->create(['role' => 'encoder', 'is_active' => true]);

        $this->actingAs($user)->get('/users')->assertForbidden();
    }

    public function test_authenticated_staff_can_add_a_student_and_manage_requirements_separately(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $cycle = AcademicCycle::create(['school_year' => '2026-2027', 'semester_number' => 1, 'status' => 'open']);

        $this->actingAs($user)->post('/students', [
            'student_id' => 'STU001',
            'full_name' => 'Test Student',
            'payout_track' => 'initial',
            'cycle_id' => $cycle->id,
            'initial_certificate_of_residency' => '1',
        ])->assertRedirectToRoute('students.index');

        $this->assertDatabaseHas('students', ['student_id' => 'STU001']);
        $this->assertDatabaseCount('student_cycle_requirements', 0);

        $studentCycle = Student::where('student_id', 'STU001')->firstOrFail()->cycles()->firstOrFail();
        $this->actingAs($user)->put("/requirements/{$studentCycle->id}", [
            'tab' => 'initial',
            'payroll_qualified' => '1',
            'initial_certificate_of_residency' => '1',
            'return_tab' => 'all',
        ])->assertRedirectToRoute('requirements.index', ['cycle_id' => $cycle->id, 'tab' => 'all']);

        $this->assertDatabaseHas('student_cycle_requirements', [
            'initial_certificate_of_residency' => true,
            'student_cycle_id' => 1,
        ]);
    }

    public function test_payrolls_only_shows_qualified_students_with_complete_requirements(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $cycle = AcademicCycle::create(['school_year' => '2026-2027', 'semester_number' => 1, 'status' => 'open']);
        $student = Student::create(['student_id' => 'READY001', 'full_name' => 'Ready Student', 'payout_track' => 'renewal']);
        $studentCycle = $student->cycles()->create([
            'academic_cycle_id' => $cycle->id,
            'payroll_qualified' => true,
        ]);
        $studentCycle->requirements()->create([
            'renewal_liquidation' => true,
            'renewal_proof_of_enrollment' => true,
            'renewal_latest_grades' => true,
        ]);

        $this->actingAs($user)->get("/payrolls?cycle_id={$cycle->id}")
            ->assertOk()
            ->assertSee('Ready Student')
            ->assertSee('Renewal');
    }
}
