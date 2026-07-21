<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\Student;
use App\Models\SisOption;
use App\Models\StudentHistory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $search = trim($request->string('search')->value());
        $students = Student::with('cycles.academicCycle')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($students) use ($search) {
                    $students->where('full_name', 'like', "%{$search}%")
                        ->orWhere('student_id', 'like', "%{$search}%")
                        ->orWhere('student_number', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%")
                        ->orWhereHas('cycles', function ($cycles) use ($search) {
                            $cycles->where('school', 'like', "%{$search}%")
                                ->orWhere('batch', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('full_name')
            ->get();

        return view('students.index', compact('students', 'search'));
    }

    public function create()
    {
        return view('students.form', $this->formData(new Student(), null));
    }

    public function store(Request $request)
    {
        [$studentData, $cycleData] = $this->validated($request, true);
        $student = Student::create($studentData);
        $cycle = $this->saveCycle($student, $cycleData, $request);
        if (filled($cycle->year_level)) {
            StudentHistory::create([
                'student_id' => $student->id,
                'user_id' => $request->user()->id,
                'academic_cycle_id' => $cycle->academic_cycle_id,
                'history_type' => 'year-level',
                'action' => 'created',
                'summary' => 'Initial year level recorded for '.$cycle->academicCycle->label().'.',
                'old_values' => ['year_level' => null],
                'new_values' => ['year_level' => $cycle->year_level],
            ]);
        }
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
        $previousCycle = $student->cycles()->where('academic_cycle_id', $cycleData['cycle_id'])->first();
        $student->update($studentData);
        $cycle = $this->saveCycle($student, $cycleData, $request);
        $previousYearLevel = $previousCycle?->year_level;
        if ($previousYearLevel !== $cycle->year_level && (filled($previousYearLevel) || filled($cycle->year_level))) {
            StudentHistory::create([
                'student_id' => $student->id,
                'user_id' => $request->user()->id,
                'academic_cycle_id' => $cycle->academic_cycle_id,
                'history_type' => 'year-level',
                'action' => 'updated',
                'summary' => 'Year level changed for '.$cycle->academicCycle->label().'.',
                'old_values' => ['year_level' => $previousYearLevel],
                'new_values' => ['year_level' => $cycle->year_level],
            ]);
        }
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
            'phone_number' => ['nullable', 'string', 'max:50'],
            'school' => ['nullable', 'string', 'max:255'], 'course' => ['nullable', 'string', 'max:255'],
            'year_level' => ['nullable', 'string', 'max:50'], 'batch' => ['nullable', 'string', 'max:50'],
        ];
        if ($creating) {
            $rules['cycle_id'] = ['required', 'exists:academic_cycles,id'];
        } else {
            $rules['cycle_id'] = ['required', 'exists:academic_cycles,id'];
        }
        $data = $request->validate($rules);
        $studentData = collect($data)->only(['student_id', 'full_name', 'payout_track', 'student_number', 'barangay', 'address', 'phone_number'])->all();
        $cycleData = collect($data)->only(['cycle_id', 'school', 'course', 'year_level', 'batch'])->all();
        return [$studentData, $cycleData];
    }

    private function saveCycle(Student $student, array $cycleData, Request $request)
    {
        return $student->cycles()->with('academicCycle')->updateOrCreate(
            ['academic_cycle_id' => $cycleData['cycle_id']],
            collect($cycleData)->except('cycle_id')->merge([
                'qualification_decided_by' => $request->user()->id,
                'qualification_decided_at' => now(),
            ])->filter(fn ($value) => $value !== null)->all(),
        );
    }
}
