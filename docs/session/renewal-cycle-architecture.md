# Renewal Cycle Architecture

Last updated: 2026-06-01

This note records the recommended implementation model for scholarship renewals, school-year changes, semester limits, and payroll linkage. It exists because renewal state is not a permanent student property. Renewals are per semester and per school year, so the data model must track time-bound participation instead of relying on a single `student.renewed` boolean.

## Problem

The current app has historical fields such as `student.renewed` and `student.payrolled`. Those fields are convenient for display, but they become inaccurate once renewal is understood as a recurring process:

- a student can renew in Semester 1 and Semester 2 of the same school year
- a student should not renew more than twice per school year
- a student should not renew more than once per semester
- a student's year level can change across school years
- payroll generation must be tied to a specific cycle and document event

The app needs to show users the active school year and semester, enforce renewal limits, preserve old renewal history, and make payroll decisions from cycle-aware records.

## Recommended Model

Use a cycle-centered model:

```txt
students/{studentId}
cycles/{cycleKey}
cycles/{cycleKey}/studentCycles/{studentId}
renewalRecords/{renewalId}
payrollRecords/{payrollId}
systemConfig/currentCycle
```

Do not create separate top-level collections for year levels such as `year1Students`, `year2Students`, `year3Students`, or `year4Students`. A student changes year level over time. Copying the full student record into year-level collections creates competing sources of truth.

Instead:

- `students` stores identity and relatively stable student details.
- `cycles` stores active school-year/semester periods.
- `cycles/{cycleKey}/studentCycles` stores per-cycle participation, including `is_active`, `year_level`, and renewal status.
- `renewalRecords` stores renewal history and limit enforcement evidence.
- `payrollRecords` stores generated payroll/document traces.
- `systemConfig/currentCycle` tells the UI which cycle the office is currently operating in.

## Current Cycle Config

```ts
systemConfig/currentCycle = {
  school_year: "2026-2027",
  sem_number: 1,
  cycle_key: "2026-2027__1",
  status: "open", // open | locked | archived
  updated_at: "...",
  updated_by: "uid"
}
```

The UI should load this config through SSR/API and display it in operational pages such as Dashboard, Renewal, Records, and Payrolls.

When an admin changes the school year or semester, the app should update this config. Old cycle records must remain untouched.

## Student Master Record

```ts
students/{studentId} = {
  student_id: "STU001",
  full_name: "...",
  student_number: "...",
  barangay: "...",
  address: "...",
  school_address: "...",
  school_course: "...",
  current_year_level: "2",
  batch: "7",
  created_at: "...",
  updated_at: "..."
}
```

Keep the master record focused on identity and stable details. Avoid using it as the source of truth for time-bound renewal status.

## Cycle Membership

```ts
cycles/2026-2027__1/studentCycles/STU001 = {
  student_id: "STU001",
  school_year: "2026-2027",
  sem_number: 1,
  cycle_key: "2026-2027__1",
  year_level: "2",
  batch: "7",
  is_active: true,
  renewal_status: "pending", // pending | renewed | payrolled | inactive | void
  renewal_id: "",
  payroll_id: "",
  created_at: "...",
  updated_at: "..."
}
```

This is where the proposed `is_active` toggle belongs. Activity is cycle-specific. A student may be active in one school year/semester and inactive in another.

Useful UI queries:

- active students for current cycle: `studentCycles where is_active == true`
- year-level scope: add `where year_level == "1"` or similar
- renewed students: `where renewal_status == "renewed"`
- payroll candidates: current-cycle records with `renewal_status == "renewed"` and no `payroll_id`

## Renewal Records

```ts
renewalRecords/{renewalId} = {
  student_id: "STU001",
  school_year: "2026-2027",
  sem_number: 1,
  cycle_key: "2026-2027__1",
  status: "renewed", // pending | renewed | payrolled | rejected | void
  created_at: "...",
  renewed_at: "...",
  payrolled_at: "",
  created_by: "uid",
  updated_by: "uid",
  payroll_id: "",
  notes: "",
  snapshot: {
    school_address: "...",
    school_course: "...",
    year_level: "2",
    batch: "7"
  }
}
```

Renewal records are the source of truth for renewal history and limit enforcement.

Backend constraints:

- maximum one renewal record per `student_id + cycle_key`
- maximum two renewal records per `student_id + school_year`
- do not allow renewal creation when the current cycle is locked or archived

The backend must enforce these rules. The UI may warn early, but it is not the authority.

## Payroll Linkage

Payroll generation should consume current-cycle renewal records or current-cycle student membership records, not `student.renewed`.

When creating payroll:

- generate the `.docx` and `.xlsx` documents
- create `payrollRecords`
- link each affected renewal record with `payroll_id`
- update the current-cycle `studentCycles/{studentId}` with `renewal_status: "payrolled"` and `payroll_id`

Payrolls are government document events. Do not allow Records actions or manual toggles to mutate payroll state.

## UI Communication

Every page that deals with renewal or payroll should know the current cycle:

- Dashboard: show current school year and semester summary.
- Renewal: default to current cycle and show status within that cycle.
- Payrolls: generate only from the selected/current cycle.
- Records: show renewal and payroll history by school year and semester.
- Catalogs or Settings: expose an admin-only current-cycle editor.

Recommended UI labels:

- `Current Cycle: 2026-2027, 1st Semester`
- `Renewed this cycle`
- `Payrolled this cycle`
- `Renewal history`
- `Cycle inactive`

Avoid labels that imply permanent state, such as `Student is renewed`, unless scoped to a school year and semester.

## Migration Path

1. Add `systemConfig/currentCycle`.
2. Add `cycles/{cycleKey}/studentCycles`.
3. Add `renewalRecords`.
4. Keep `student.renewed` temporarily only as compatibility display data.
5. Make Renewal write renewal records and cycle membership updates instead of mutating only `student.renewed`.
6. Make Payrolls consume renewal records or cycle membership records for the active cycle.
7. Backfill existing `student.renewed === true` into inferred renewal records for a chosen school year/semester.
8. Stop showing or remove `student.renewed` once migrated.

## Key Decision

Create collections per cycle, not per year level.

Year level is an attribute inside a cycle membership record. The cycle is the historical boundary that matters for renewals and payrolls.
