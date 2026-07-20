# Scholarship Management System — Laravel Foundation

This application is the planned replacement for the Firebase/Next.js SIS. The existing application remains separate while the relational model is designed and implemented deliberately.

## Operating philosophy

The database must preserve what staff actually decided and recorded. It must not silently infer or mutate business statuses from document checkboxes, payroll generation, or background logic.

- A student is a stable master record.
- A school year and semester are an explicit academic cycle; there are exactly two semesters per school year.
- Requirements are records for a student in a specific cycle.
- Requirement completion is evidence and progress, not an automatic payroll decision.
- Initial-payroll history and renewal-payroll history are distinct concepts.
- Renewal is cycle-scoped: one student can have separate renewal records for each year/semester.
- Do not create a broad `payroll_status` field on the student or cycle. The client-approved payroll lookup is the way to inspect prior payroll history; the system must not invent a renewal/payroll state from that lookup.
- User-controlled qualification decisions are explicit, attributable, and auditable.
- A generic payroll event may contain both initial and renewal students. Initial/renewal is classification metadata, not a separate payroll subsystem.
- Renewal payroll history is optional business data, not a mandatory lifecycle state. If the office chooses not to trace renewal payrolls, the model must still work through the manual cycle qualification decision.
- Do not expose internal lifecycle concepts as automatic “smart” behavior to staff. Show the source records and let authorized users change the statuses the business has chosen to control.

## Planned relational shape

```text
students
  └── student_cycles
        ├── student_cycle_requirements
        ├── qualification_decisions
        └── payroll_items ─── payrolls
```

### Core records

- `students`: stable identity, contact, and residence details.
- `academic_cycles`: one row for each school year/semester; constrain semesters to `1` and `2`.
- `student_cycles`: the student's relationship to one academic cycle, with academic snapshots and active participation.
- `student_cycle_requirements`: requirements for that exact student/cycle; no nested timeline arrays.
- `qualification_decisions`: the manual user-controlled decision for that student/cycle. Use `pending`, `qualified`, and `excluded`, with actor, timestamp, and note.
- `payrolls`: generic payroll preparation events.
- `payroll_items`: students included in a payroll, retaining `initial` or `renewal` as classification metadata.

## Phase 1 status

Implemented in this scaffold:

- Session login and logout.
- Admin and encoder roles.
- Admin-only user creation for admin or encoder accounts.
- Student creation and editing.
- Two-semester academic-cycle records.
- Cycle-scoped requirements.
- Explicit manual qualification decisions.

Still intentionally out of scope:

- Student data migration from Firestore.
- Payroll generation and payroll document tracing.
- Automatic qualification or automatic lifecycle mutation.
- Renewal payroll status fields.
