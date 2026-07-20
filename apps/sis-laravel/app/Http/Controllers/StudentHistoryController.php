<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\StudentHistory;
use Illuminate\Http\Request;

class StudentHistoryController extends Controller
{
    public function index(Request $request, Student $student)
    {
        $tab = in_array($request->string('tab')->value(), ['requirements', 'year-level'], true)
            ? $request->string('tab')->value()
            : 'requirements';

        $history = StudentHistory::with(['user', 'academicCycle'])
            ->where('student_id', $student->id)
            ->where('history_type', $tab)
            ->latest()
            ->get();

        return view('requirements.history', compact('student', 'history', 'tab'));
    }
}
