---
name: sis-emulator-suite
description: Use when working on the SamStaticFirebase SIS app and needing to inspect, verify, or debug the local Firebase Emulator Suite, especially Firestore student records, requirement maps, payroll lifecycle state, operation logs, Auth users, emulator health, or questions about whether UI behavior matches emulator data. Prefer this skill before writing one-off Firebase inspection scripts.
---

# SIS Emulator Suite

## Quick Start

Use the checked-in toolbox at `apps/sis-next/scripts/emulator-suite.mjs` before creating custom scripts.

Run commands from the repo root:

```bash
npm run emu:status
npm run emu:collections
npm run emu:students -- --limit 20 --filter "juan"
npm run emu:student -- STU001
npm run emu:requirements -- --limit 20 --filter "juan"
npm run emu:auth-users
npm run emu:logs -- --limit 20
```

If root npm argument forwarding looks odd in terminal output, the toolbox still accepts positional fallbacks. These are equivalent:

```bash
npm run emu:students -- --limit 2 --filter Denver
node apps/sis-next/scripts/emulator-suite.mjs students 2 Denver
```

## Workflow

1. Check emulator availability with `npm run emu:status` before investigating local data.
2. Check collection counts with `npm run emu:collections` when data seems missing.
3. Use `npm run emu:students -- --filter "<name-or-id>"` for student list symptoms.
4. Use `npm run emu:student -- <studentId>` before changing data model or qualification logic.
5. Use `npm run emu:requirements -- --filter "<name-or-id>"` for requirement/payroll qualification bugs.
6. Use `npm run emu:logs -- --limit 20` to verify insert/update/delete/export audit behavior.
7. Use `npm run emu:auth-users` when role or permission behavior is suspicious.

## Guardrails

- Do not build new ad hoc emulator readers until this toolbox cannot answer the question.
- Prefer read-only inspection first. If mutation is needed, patch the toolbox with an explicit subcommand rather than hiding writes inside temporary scripts.
- Keep emulator assumptions aligned with `firebase.json`: Auth `9099`, Firestore `8080`, Functions `5001`, Hosting `5000`, UI `4000`.
- Treat production Firebase separately. This skill is for the local emulator suite unless the user explicitly asks for production data access.
- When debugging requirements, remember the current model: initial requirements are global at `students/{studentId}.requirements`; renewal requirements are semester-specific in `semester_records[]`.

## More Detail

Read `references/command-reference.md` when adding toolbox commands, explaining outputs, or investigating requirement/payroll lifecycle details.
