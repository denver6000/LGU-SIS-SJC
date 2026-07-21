<?php

namespace Tests\Feature;

use App\Models\AcademicCycle;
use App\Models\ActivityLog;
use App\Models\Student;
use App\Models\StudentCycle;
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

    public function test_encoder_can_update_own_profile(): void
    {
        $user = User::factory()->create(['role' => 'encoder', 'is_active' => true, 'password' => 'password']);

        $this->actingAs($user)->get('/profile')->assertOk()->assertSee('My profile');
        $this->actingAs($user)->put('/profile', [
            'name' => 'Updated Encoder',
            'email' => $user->email,
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertRedirect('/profile');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Updated Encoder']);
    }

    public function test_admin_can_update_another_users_account(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $encoder = User::factory()->create(['role' => 'encoder', 'is_active' => true]);

        $this->actingAs($admin)->get("/users/{$encoder->id}/edit")->assertOk()->assertSee('Manage user');
        $this->actingAs($admin)->put("/users/{$encoder->id}", [
            'name' => 'Renamed Encoder',
            'email' => $encoder->email,
            'role' => 'encoder',
            'is_active' => '1',
        ])->assertRedirectToRoute('users.index');

        $this->assertDatabaseHas('users', ['id' => $encoder->id, 'name' => 'Renamed Encoder']);
    }

    public function test_encoder_cannot_access_payroll_but_can_edit_student_profile(): void
    {
        $user = User::factory()->create(['role' => 'encoder', 'is_active' => true]);
        $student = Student::create(['student_id' => 'STU002', 'full_name' => 'Restricted Student', 'payout_track' => 'initial']);
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);

        $this->actingAs($user)->get('/payrolls')->assertForbidden();
        $this->actingAs($user)->get("/students/{$student->id}/edit")->assertOk();
        $this->actingAs($user)->put("/students/{$student->id}", [
            'student_id' => $student->student_id,
            'full_name' => 'Updated Encoder Student',
            'payout_track' => 'initial',
            'cycle_id' => $cycle->id,
        ])->assertRedirectToRoute('students.index');

        $this->assertDatabaseHas('students', ['id' => $student->id, 'full_name' => 'Updated Encoder Student']);
    }

    public function test_activity_log_is_admin_only_and_records_write_actions(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $encoder = User::factory()->create(['role' => 'encoder', 'is_active' => true]);
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);

        $this->actingAs($encoder)->post('/students', [
            'student_id' => 'AUDIT001',
            'full_name' => 'Audit Student',
            'payout_track' => 'initial',
            'cycle_id' => $cycle->id,
        ])->assertRedirectToRoute('students.index');

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $encoder->id,
            'action' => 'students.store',
            'method' => 'POST',
            'status_code' => 302,
        ]);

        $this->actingAs($encoder)->get('/activity')->assertForbidden();
        $this->actingAs($admin)->get('/activity')->assertOk()->assertSee('students.store');
        $this->assertGreaterThan(0, ActivityLog::count());
    }

    public function test_student_history_separates_year_level_and_requirements_changes(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);
        $student = Student::create(['student_id' => 'HISTORY001', 'full_name' => 'History Student', 'payout_track' => 'initial']);

        $this->actingAs($admin)->put("/students/{$student->id}", [
            'student_id' => $student->student_id,
            'full_name' => $student->full_name,
            'payout_track' => 'initial',
            'cycle_id' => $cycle->id,
            'year_level' => '2nd Year',
        ])->assertRedirectToRoute('students.index');

        $this->actingAs($admin)->put("/requirements/students/{$student->id}", [
            'cycle_id' => $cycle->id,
            'payout_track' => 'initial',
            'payroll_qualified' => '1',
            'initial_certificate_of_residency' => '1',
        ])->assertRedirectToRoute('requirements.index', ['cycle_id' => $cycle->id, 'tab' => 'all']);

        $this->assertDatabaseHas('student_history', ['student_id' => $student->id, 'history_type' => 'year-level']);
        $this->assertDatabaseHas('student_history', ['student_id' => $student->id, 'history_type' => 'requirements']);
        $this->actingAs($admin)->get("/requirements/students/{$student->id}/history?tab=requirements")
            ->assertOk()->assertSee('Requirements History')->assertSee('Initial Certificate Of Residency');
        $this->actingAs($admin)->get("/requirements/students/{$student->id}/history?tab=year-level")
            ->assertOk()->assertSee('Year Change History')->assertSee('2nd Year');
    }

    public function test_authenticated_staff_can_add_a_student_and_manage_requirements_separately(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);

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
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);
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
            ->assertSee('Renewal')
            ->assertSee('1st Semester');

        $this->actingAs($user)->post("/payrolls/{$studentCycle->id}/mark-payrolled", ['type' => 'renewal'])
            ->assertRedirectToRoute('payrolls.index', [
                'school_year' => '2026-2027',
                'semester_number' => 1,
                'type' => 'renewal',
                'status' => 'ready',
            ]);
        $this->assertDatabaseHas('student_cycles', ['id' => $studentCycle->id, 'payrolled_by' => $user->id]);
        $this->actingAs($user)->get('/payrolls?school_year=2026-2027&semester_number=1&type=renewal&status=payrolled')
            ->assertOk()->assertSee('Ready Student')->assertSee('Payrolled');
        $this->actingAs($user)->post("/payrolls/{$studentCycle->id}/mark-payrolled", ['type' => 'renewal'])
            ->assertStatus(409);
    }

    public function test_payroll_recovery_is_admin_only_and_audited(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $encoder = User::factory()->create(['role' => 'encoder', 'is_active' => true]);
        $cycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 2], ['status' => 'open']);
        $student = Student::create(['student_id' => 'RECOVERY001', 'full_name' => 'Recovery Student', 'payout_track' => 'renewal']);
        $studentCycle = StudentCycle::create([
            'student_id' => $student->id,
            'academic_cycle_id' => $cycle->id,
            'payroll_qualified' => true,
            'payrolled_at' => now(),
            'payrolled_by' => $admin->id,
        ]);

        $this->actingAs($encoder)->get('/payrolls/recovery')->assertForbidden();
        $this->actingAs($admin)->get('/payrolls/recovery?school_year=2026-2027&semester_number=2')
            ->assertOk()->assertSee('Recovery Student')->assertSee('Revert payroll status');
        $this->actingAs($admin)->post('/payrolls/recovery/revert', [
            'cycle_id' => $cycle->id,
            'student_cycle_ids' => [$studentCycle->id],
            'reason' => 'Duplicate payroll entry correction',
        ])->assertRedirectToRoute('payrolls.recovery', ['school_year' => '2026-2027', 'semester_number' => 2]);

        $this->assertDatabaseHas('student_cycles', ['id' => $studentCycle->id, 'payrolled_at' => null, 'payrolled_by' => null]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'payrolls.revert', 'user_id' => $admin->id]);
    }

    public function test_cycle_correction_is_admin_only_and_merges_then_removes_source_records(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $encoder = User::factory()->create(['role' => 'encoder', 'is_active' => true]);
        $sourceCycle = AcademicCycle::firstOrCreate(['school_year' => '2035-2036', 'semester_number' => 1], ['status' => 'open']);
        $targetCycle = AcademicCycle::firstOrCreate(['school_year' => '2026-2027', 'semester_number' => 1], ['status' => 'open']);
        $student = Student::create(['student_id' => 'CORRECT001', 'full_name' => 'Correction Student', 'payout_track' => 'renewal']);
        $source = StudentCycle::create([
            'student_id' => $student->id,
            'academic_cycle_id' => $sourceCycle->id,
            'payroll_qualified' => true,
            'year_level' => '2nd Year',
        ]);
        $source->requirements()->create(['renewal_liquidation' => true]);
        $target = StudentCycle::create(['student_id' => $student->id, 'academic_cycle_id' => $targetCycle->id]);

        $this->actingAs($encoder)->get('/records/cycle-correction')->assertForbidden();
        $this->actingAs($admin)->get("/records/cycle-correction?source_cycle_id={$sourceCycle->id}&target_cycle_id={$targetCycle->id}")
            ->assertOk()->assertSee('Correction Student')->assertSee('Merge and remove source records');

        $this->actingAs($admin)->post('/records/cycle-correction', [
            'source_cycle_id' => $sourceCycle->id,
            'target_cycle_id' => $targetCycle->id,
            'confirmation' => '1',
        ])->assertRedirect();

        $this->assertDatabaseMissing('student_cycles', ['id' => $source->id]);
        $this->assertDatabaseHas('student_cycles', ['id' => $target->id, 'payroll_qualified' => true]);
        $this->assertDatabaseHas('student_cycle_requirements', ['student_cycle_id' => $target->id, 'renewal_liquidation' => true]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'records.cycle-correction', 'user_id' => $admin->id]);
    }
}
