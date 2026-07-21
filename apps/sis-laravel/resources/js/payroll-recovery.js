document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-payroll-recovery-form]');
    if (!form) return;
    const buttons = [...form.querySelectorAll('[data-recovery-select-all]')];
    const rows = [...form.querySelectorAll('[data-recovery-row]')];
    const reason = form.querySelector('[name="reason"]');
    const sync = () => {
        const allSelected = rows.length > 0 && rows.every((row) => row.checked);
        buttons.forEach((button) => {
            button.textContent = allSelected ? 'Deselect all' : 'Select all';
            button.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
        });
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
        const shouldSelect = !rows.length || !rows.every((row) => row.checked);
        rows.forEach((row) => { row.checked = shouldSelect; });
        sync();
    }));
    rows.forEach((row) => row.addEventListener('change', sync));
    form.addEventListener('submit', (event) => {
        const selected = rows.filter((row) => row.checked);
        if (!selected.length) { event.preventDefault(); alert('Select at least one payrolled student.'); return; }
        if (!reason.value.trim()) { event.preventDefault(); reason.focus(); alert('Enter the emergency reason.'); return; }
        if (!window.confirm(`Revert payroll status for ${selected.length} selected student(s)? This will be recorded in Activity.`)) event.preventDefault();
    });
    sync();
});
