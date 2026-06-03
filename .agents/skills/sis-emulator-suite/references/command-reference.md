# Command Reference

## Commands

`npm run emu:status`

Checks whether the local emulator ports are open. Use first when API calls fail or the app appears disconnected.

`npm run emu:collections`

Prints document counts for expected SIS collections: students, trash, payoutRecords, operationLogs, systemConfig, schoolCourses, barangays, schools, courses, and batches.

`npm run emu:students -- --limit 20 --filter "query"`

Shows a compact student table with initial requirement readiness, permanent payroll lifecycle, and semester record count. The filter matches student id, full name, student number, school, and barangay.

`npm run emu:student -- STU001`

Prints the full student JSON. Use before changing student model logic, requirement qualification, or payroll lifecycle behavior.

`npm run emu:requirements -- --limit 20 --filter "query"`

Shows requirement-focused rows with global initial readiness, latest semester cycle, latest renewal readiness, and permanent payroll lifecycle.

`npm run emu:auth-users`

Lists emulator Auth users and custom claims. Use for admin/encoder permission issues.

`npm run emu:logs -- --limit 20`

Lists recent `operationLogs` entries. Use after insert, update, delete, restore, and payroll export flows.

## Requirement Debugging Pattern

For "Register selected requirements but Requirements cannot see them":

1. Run `npm run emu:students -- --filter "<student>"`.
2. Confirm `initial_ready` is expected.
3. Run `npm run emu:student -- <studentId>`.
4. Inspect `requirements` for the global six initial flags.
5. Inspect `semester_records[].renewal_requirements` only for per-semester renewal state.
6. If `requirements` is empty but old `semester_records[].initial_payout_requirements` has values, the UI/server migration fallback should surface them until the record is saved again.

## Payroll Lifecycle Debugging Pattern

For "student should appear in Payrolls":

1. Run `npm run emu:requirements -- --filter "<student>"`.
2. If `permanent_payrolled` is false, the student is a New candidate when global initial requirements are `6/6` and the selected cycle is not payrolled.
3. If `permanent_payrolled` is true, the student is a Renewal candidate only when the selected semester renewal requirements are `3/3` and that selected cycle is not already payrolled.
4. Use `npm run emu:student -- <studentId>` to inspect selected-cycle `payroll_status`, `payroll_id`, and `payrolled_at`.
