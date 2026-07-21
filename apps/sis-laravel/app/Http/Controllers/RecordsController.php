<?php

namespace App\Http\Controllers;

use App\Models\SisOption;
use App\Models\AcademicCycle;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RecordsController extends Controller
{
    private const COLLECTIONS = ['barangays', 'schools', 'batches', 'courses'];

    public function index()
    {
        $options = SisOption::whereIn('collection_name', self::COLLECTIONS)
            ->orderBy('collection_name')->orderBy('name')->get()->groupBy('collection_name');

        return view('records.index', [
            'barangays' => $options->get('barangays', collect()),
            'schools' => $options->get('schools', collect()),
            'batches' => $options->get('batches', collect()),
            'courses' => $options->get('courses', collect()),
            'cycles' => AcademicCycle::orderByDesc('school_year')->orderBy('semester_number')->get(),
        ]);
    }

    public function storeCycle(Request $request)
    {
        $data = $request->validate([
            'school_year' => ['required', 'regex:/^\d{4}-\d{4}$/'],
            'semester_number' => [
                'required', 'integer', 'in:1,2',
                Rule::unique('academic_cycles', 'semester_number')->where(fn ($query) => $query->where('school_year', $request->string('school_year')->value())),
            ],
        ]);

        AcademicCycle::create($data + ['status' => 'open']);

        return redirect()->route('records.index')->with('success', 'Academic cycle added.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'collection_name' => ['required', 'in:barangays,schools,batches,courses'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        SisOption::create([
            'collection_name' => $data['collection_name'],
            'source_id' => (string) Str::uuid(),
            'name' => trim($data['name']),
            'added_at' => now(),
        ]);

        return redirect()->route('records.index')->with('success', ucfirst($data['collection_name']).' entry added.');
    }

    public function destroy(SisOption $sisOption)
    {
        abort_unless(in_array($sisOption->collection_name, self::COLLECTIONS, true), 404);
        $sisOption->delete();

        return redirect()->route('records.index')->with('success', 'Record entry removed. Existing student values were not changed.');
    }
}
