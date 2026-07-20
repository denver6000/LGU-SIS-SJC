@extends('layouts.app')
@section('content')
<div class="page-heading"><div><p class="eyebrow">Requirements Timeline · {{ $studentCycle->academicCycle->label() }}</p><h1>{{ $studentCycle->student->full_name }}</h1><p class="muted">Choose the student’s payout type, then manage only the requirements relevant to that type.</p></div></div>
<form method="POST" action="{{ route('requirements.update', $studentCycle->student) }}" class="form-card stack">@csrf @method('PUT')<input type="hidden" name="cycle_id" value="{{ $studentCycle->academic_cycle_id }}"><input type="hidden" name="return_tab" value="{{ request('return_tab', 'all') }}">
<div class="form-section"><h2>Payout type</h2><p class="muted">This classification is stored on the student. Requirement completion and payroll qualification remain specific to this year and semester.</p><div class="toggle-field"><span class="field-label">Student is for</span><div class="segmented-control" role="radiogroup" aria-label="Student payout type"><label><input type="radio" name="payout_track" value="initial" @checked($studentCycle->student->payout_track === 'initial') data-payout-type="initial"> Initial payout</label><label><input type="radio" name="payout_track" value="renewal" @checked($studentCycle->student->payout_track === 'renewal') data-payout-type="renewal"> Renewal payout</label></div></div></div>
<div class="form-section"><h2>Manual payroll qualification</h2><p class="muted">Qualification is a separate manual decision for this year/semester.</p><label class="check"><input type="checkbox" name="payroll_qualified" value="1" @checked($studentCycle->payroll_qualified)> Qualify for payroll</label><label>Decision note<textarea name="qualification_note">{{ $studentCycle->qualification_note }}</textarea></label></div>
<div class="form-section requirement-panel" data-requirement-panel="initial"><h2>Initial payout requirements</h2><div class="requirement-grid">@foreach($initialFields as $field => $label)<label class="check"><input type="checkbox" name="{{ $field }}" value="1" @checked($studentCycle->requirements?->{$field})> {{ $label }}</label>@endforeach</div></div>
<div class="form-section requirement-panel" data-requirement-panel="renewal"><h2>Renewal payout requirements</h2><div class="requirement-grid">@foreach($renewalFields as $field => $label)<label class="check"><input type="checkbox" name="{{ $field }}" value="1" @checked($studentCycle->requirements?->{$field})> {{ $label }}</label>@endforeach</div></div>
<div><button class="primary-button" type="submit">Save requirements</button> <a href="{{ route('requirements.index', ['cycle_id' => $studentCycle->academic_cycle_id, 'tab' => request('return_tab', $tab)]) }}">Cancel</a></div></form>
<script>
document.querySelectorAll('[data-payout-type]').forEach((input) => input.addEventListener('change', () => {
    const selected = document.querySelector('[data-payout-type]:checked')?.value;
    document.querySelectorAll('[data-requirement-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.requirementPanel !== selected;
    });
}));
document.querySelector('[data-payout-type]:checked')?.dispatchEvent(new Event('change'));
</script>
@endsection
