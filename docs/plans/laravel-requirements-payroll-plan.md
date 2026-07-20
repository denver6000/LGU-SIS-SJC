# Laravel Requirements and Payroll Plan

## Revised direction

The Laravel application will replace the Firebase/Next.js data model with explicit SQL relations. The first design priority is requirements management for a student in a specific school year and semester.

## Data principles

- `students` stores stable student information only.
- `academic_cycles` stores one row per school year/semester, with semesters limited to 1 and 2.
- `student_cycles` connects a student to one academic cycle and forms the student's timeline.
- Requirements belong to `student_cycles`; they are never stored as nested timeline arrays.
- Requirement completion is displayed as evidence/progress and must not automatically mutate qualification.
- Qualification is a user-controlled decision with `pending`, `qualified`, or `excluded` state, actor, timestamp, and note.
- Initial-payroll history and renewal-payroll history are separate concepts, but they use the same generic payroll tables.
- Do not add a broad `payroll_status` field to students or student-cycle records. Payroll history is queried explicitly, not converted into an automatic lifecycle state.
- Renewal information is cycle-scoped. Initial payroll is not treated as a recurring semester payroll.
- Payroll lookup is an inspection/history feature. It must not silently assign, clear, or infer a student's business state.
- Renewal payroll tracing is optional; the requirements and manual qualification model must not depend on renewal payroll records existing.
- Payroll generation records what was generated; it does not rewrite requirements or user-controlled qualification decisions without an explicit user action.

## Planned relations

```text
students
  └── student_cycles
        ├── student_cycle_requirements
        ├── qualification_decisions
        └── payroll_items ─── payrolls
```

Initial and renewal are stored as classification metadata on the relevant decision/payroll item. They do not receive separate payroll workflows or tables.

## Phase 1 implementation boundary

Implemented: Laravel foundation, login/logout, admin-created staff accounts, student creation/editing, two-semester cycles, cycle-scoped requirements, and manual qualification decisions.

Deferred: payroll generation, payroll tracing, Firebase migration, and automatic lifecycle mutation.
