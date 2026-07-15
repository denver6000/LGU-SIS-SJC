<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function index()
    {
        return view('students.index', ['students' => Student::with('cycles.academicCycle')->orderBy('full_name')->get()]);
    }

    public function create()
    {
        return view('students.form', ['student' => new Student(), 'cycles' => $this->cycles(), 'selectedCycle' => null]);
    }

    public function store(Request $request)
    {
        [$studentData, $cycleData] = $this->validated($request, true);
        $student = Student::create($studentData);
        $this->saveCycle($student, $cycleData, $request);
        return redirect()->route('students.index')->with('success', 'Student added.');
    }

    public function edit(Student $student, Request $request)
    {
        $cycle = $student->cycles()->with(['academicCycle', 'requirements'])->find($request->integer('cycle_id'))
            ?? $student->cycles()->with(['academicCycle', 'requirements'])->latest()->first();
        return view('students.form', ['student' => $student, 'cycles' => $this->cycles(), 'selectedCycle' => $cycle]);
    }

    public function update(Request $request, Student $student)
    {
        [$studentData, $cycleData] = $this->validated($request, false, $student);
        $student->update($studentData);
        $this->saveCycle($student, $cycleData, $request);
        return redirect()->route('students.index')->with('success', 'Student updated.');
    }

    private function cycles() { return AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get(); }

    private function validated(Request $request, bool $creating, ?Student $student = null): array
    {
        $rules = [
            'student_id' => ['required', 'string', 'max:50', Rule::unique('students', 'student_id')->ignore($student?->id)],
            'full_name' => ['required', 'string', 'max:255'], 'student_number' => ['nullable', 'string', 'max:100'],
            'barangay' => ['nullable', 'string', 'max:255'], 'address' => ['nullable', 'string'],
            'phone_number' => ['nullable', 'string', 'max:50'], 'cycle_id' => ['required', 'exists:academic_cycles,id'],
            'school' => ['nullable', 'string', 'max:255'], 'course' => ['nullable', 'string', 'max:255'],
            'year_level' => ['nullable', 'string', 'max:50'], 'batch' => ['nullable', 'string', 'max:50'],
        ];
        $data = $request->validate($rules);
        $studentData = collect($data)->only(['student_id', 'full_name', 'student_number', 'barangay', 'address', 'phone_number'])->all();
        $cycleData = collect($data)->only(['cycle_id', 'school', 'course', 'year_level', 'batch'])->all();
        return [$studentData, $cycleData];
    }

    private function saveCycle(Student $student, array $cycleData, Request $request): void
    {
        $cycle = $student->cycles()->updateOrCreate(
            ['academic_cycle_id' => $cycleData['cycle_id']],
            collect($cycleData)->except('cycle_id')->merge([
                'payout_classification' => $student->cycles()->where('academic_cycle_id', $cycleData['cycle_id'])->exists() ? null : 'initial',
                'qualification_status' => $student->cycles()->where('academic_cycle_id', $cycleData['cycle_id'])->exists() ? null : 'pending',
                'qualification_decided_by' => $request->user()->id,
                'qualification_decided_at' => now(),
            ])->filter(fn ($value) => $value !== null)->all(),
        );
    }
}
