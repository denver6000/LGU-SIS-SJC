<?php

namespace App\Http\Controllers;

use App\Models\AcademicCycle;
use App\Models\ActivityLog;
use App\Models\StudentCycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CycleCorrectionController extends Controller
{
    public function index(Request $request)
    {
        $cycles = AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get();
        $source = $cycles->firstWhere('id', $request->integer('source_cycle_id'));
        $target = $cycles->firstWhere('id', $request->integer('target_cycle_id'));
        $preview = $source && $target && $source->id !== $target->id
            ? $this->preview($source, $target)
            : null;

        return view('records.cycle-correction', compact('cycles', 'source', 'target', 'preview'));
    }

    public function merge(Request $request)
    {
        $data = $request->validate([
            'source_cycle_id' => ['required', 'integer', 'exists:academic_cycles,id'],
            'target_cycle_id' => ['required', 'integer', 'exists:academic_cycles,id', 'different:source_cycle_id'],
            'confirmation' => ['accepted'],
        ]);

        $result = DB::transaction(function () use ($request, $data): array {
            $source = AcademicCycle::lockForUpdate()->findOrFail($data['source_cycle_id']);
            $target = AcademicCycle::lockForUpdate()->findOrFail($data['target_cycle_id']);
            $sourceRows = StudentCycle::with(['student', 'requirements'])
                ->where('academic_cycle_id', $source->id)
                ->lockForUpdate()
                ->get();

            abort_if($sourceRows->isEmpty(), 422, 'The source cycle has no student records to correct.');
            abort_if($sourceRows->contains(fn (StudentCycle $row) => $row->isPayrolled()), 422, 'The correction was stopped because a source record is already payrolled.');

            $targetRows = StudentCycle::with('requirements')
                ->where('academic_cycle_id', $target->id)
                ->whereIn('student_id', $sourceRows->pluck('student_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('student_id');

            $created = 0;
            $merged = 0;
            foreach ($sourceRows as $sourceRow) {
                $targetRow = $targetRows->get($sourceRow->student_id);
                if (! $targetRow) {
                    $targetRow = $sourceRow->replicate();
                    $targetRow->academic_cycle_id = $target->id;
                    $targetRow->save();
                    $created++;
                } else {
                    if ($sourceRow->payroll_qualified && ! $targetRow->payroll_qualified) {
                        $targetRow->payroll_qualified = true;
                        $targetRow->qualification_decided_by ??= $sourceRow->qualification_decided_by;
                        $targetRow->qualification_decided_at ??= $sourceRow->qualification_decided_at;
                        $targetRow->qualification_note ??= $sourceRow->qualification_note;
                        $targetRow->save();
                    }
                    $merged++;
                }

                if ($sourceRow->requirements) {
                    $requirements = $targetRow->requirements()->firstOrCreate([]);
                    foreach (array_merge(StudentCycle::INITIAL_REQUIREMENTS, StudentCycle::RENEWAL_REQUIREMENTS) as $field) {
                        if ($sourceRow->requirements->{$field}) {
                            $requirements->{$field} = true;
                        }
                    }
                    $requirements->save();
                }
            }

            $studentNames = $sourceRows->map(fn (StudentCycle $row) => [
                'student_id' => $row->student->student_id,
                'full_name' => $row->student->full_name,
            ])->values()->all();
            $deleted = $sourceRows->count();
            StudentCycle::whereIn('id', $sourceRows->pluck('id'))->delete();

            ActivityLog::record($request, 'records.cycle-correction', "Merged {$deleted} student cycle record(s) into {$target->label()} and removed them from {$source->label()}.", [
                'source_cycle_id' => $source->id,
                'source_cycle' => $source->label(),
                'target_cycle_id' => $target->id,
                'target_cycle' => $target->label(),
                'student_count' => $deleted,
                'created_target_records' => $created,
                'merged_existing_target_records' => $merged,
                'students' => $studentNames,
            ], 302);

            return compact('source', 'target', 'deleted', 'created', 'merged');
        });

        return redirect()->route('records.cycle-correction', [
            'source_cycle_id' => $result['source']->id,
            'target_cycle_id' => $result['target']->id,
        ])->with('success', "Corrected {$result['deleted']} record(s): {$result['created']} created in the target and {$result['merged']} existing target record(s) merged.");
    }

    private function preview(AcademicCycle $source, AcademicCycle $target): array
    {
        $sourceRows = StudentCycle::with(['student', 'requirements'])
            ->where('academic_cycle_id', $source->id)
            ->orderBy('id')
            ->get();
        $targetRows = StudentCycle::where('academic_cycle_id', $target->id)
            ->whereIn('student_id', $sourceRows->pluck('student_id'))
            ->get(['id', 'student_id'])
            ->keyBy('student_id');

        return [
            'rows' => $sourceRows,
            'total' => $sourceRows->count(),
            'existing_target' => $targetRows->count(),
            'missing_target' => $sourceRows->whereNotIn('student_id', $targetRows->keys())->count(),
            'target_rows' => $targetRows,
            'payrolled' => $sourceRows->filter(fn (StudentCycle $row) => $row->isPayrolled())->count(),
            'qualified' => $sourceRows->where('payroll_qualified', true)->count(),
        ];
    }
}
