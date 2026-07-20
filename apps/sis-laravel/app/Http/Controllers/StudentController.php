<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\Student;
use App\Models\SisOption;
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
        return view('students.form', $this->formData(new Student(), null));
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
        return view('students.form', $this->formData($student, $cycle));
    }

    public function update(Request $request, Student $student)
    {
        [$studentData, $cycleData] = $this->validated($request, false, $student);
        $student->update($studentData);
        $this->saveCycle($student, $cycleData, $request);
        return redirect()->route('students.index')->with('success', 'Student updated.');
    }

    private function cycles() { return AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get(); }

    private function formData(Student $student, $selectedCycle): array
    {
        return [
            'student' => $student,
            'cycles' => $this->cycles(),
            'selectedCycle' => $selectedCycle,
            'barangays' => SisOption::where('collection_name', 'barangays')->orderBy('name')->pluck('name'),
            'schools' => SisOption::where('collection_name', 'schools')->orderBy('name')->pluck('name'),
            'batches' => SisOption::where('collection_name', 'batches')->orderBy('name')->pluck('name'),
            'courses' => SisOption::where('collection_name', 'courses')->orderBy('name')->pluck('name'),
        ];
    }

    private function validated(Request $request, bool $creating, ?Student $student = null): array
    {
        $rules = [
            'student_id' => ['required', 'string', 'max:50', Rule::unique('students', 'student_id')->ignore($student?->id)],
            'full_name' => ['required', 'string', 'max:255'], 'payout_track' => ['required', 'in:initial,renewal'], 'student_number' => ['nullable', 'string', 'max:100'],
            'barangay' => ['nullable', 'string', 'max:255'], 'address' => ['nullable', 'string'],
            'phone_number' => ['nullable', 'string', 'max:50'], 'cycle_id' => ['required', 'exists:academic_cycles,id'],
            'school' => ['nullable', 'string', 'max:255'], 'course' => ['nullable', 'string', 'max:255'],
            'year_level' => ['nullable', 'string', 'max:50'], 'batch' => ['nullable', 'string', 'max:50'],
        ];
        $data = $request->validate($rules);
        $studentData = collect($data)->only(['student_id', 'full_name', 'payout_track', 'student_number', 'barangay', 'address', 'phone_number'])->all();
        $cycleData = collect($data)->only(['cycle_id', 'school', 'course', 'year_level', 'batch'])->all();
        return [$studentData, $cycleData];
    }

    private function saveCycle(Student $student, array $cycleData, Request $request): void
    {
        $cycle = $student->cycles()->updateOrCreate(
            ['academic_cycle_id' => $cycleData['cycle_id']],
            collect($cycleData)->except('cycle_id')->merge([
                'qualification_decided_by' => $request->user()->id,
                'qualification_decided_at' => now(),
            ])->filter(fn ($value) => $value !== null)->all(),
        );
    }
}
