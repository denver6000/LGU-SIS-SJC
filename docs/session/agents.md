# Session Architecture And Handoff Directives

Last updated: 2026-06-01

This document records implementation history, architecture choices, bug context, and working directives from the `public/` static SIS migration into `apps/sis-next/`. Treat it as project memory for future agents and human reviewers.

## Current Product Shape

The active app is `apps/sis-next`, a Next.js App Router application replacing the legacy static `public/` app. The legacy static app remains useful as behavior reference, especially `public/js/store.js` and route HTML pages, but new user-facing SIS work should land in `apps/sis-next`.

The application uses a sidebar/nav rail with explicit App Router pages:

- `/dashboard`
- `/catalogs`
- `/register`
- `/renewal`
- `/records`
- `/users`
- `/payrolls`
- `/trash`

Legacy or removed routes:

- `/exports` redirects to `/payrolls`.
- `/setup` redirects to `/catalogs`.
- `Import`, `Payouts`, and `Setup` are removed from visible navigation.

## Authentication And Roles

Authentication is SSR-aware and Firebase-backed.

- Server session cookie: `__session`
- Short-lived ID-token cookie: `__session_id_token`
- Server auth helpers live under `apps/sis-next/app/lib/server/auth.ts`
- Client auth/session refresh is handled through `apps/sis-next/app/auth-provider.tsx` and `/api/auth/session`

Roles:

- `admin`: full administrative role.
- `encoder`: normal non-admin role.
- Legacy custom claim `user` is recognized only for backward compatibility and normalized as `encoder`.

Important role decision:

- New non-admin users must use custom claims `{ role: "encoder", encoder: true }`.
- Do not create new `{ role: "user", user: true }` accounts.
- Keep backward compatibility until all old users are migrated.

## Emulator Behavior

`APP_ENV=dev` in `apps/sis-next/.env.local` means the app should connect to local Firebase emulators.

Expected emulator ports:

- Auth: `127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`

Server code reads `process.env.APP_ENV`. Client code receives the mirrored public value through Next config.

Root `npm run emulators` was updated to import/export local emulator state:

```json
--import=./emulator-data/local-suite --export-on-exit=./emulator-data/local-suite
```

Operational note:

- Stop emulators cleanly with `Ctrl+C` so Auth users and Firestore data are exported.
- Do not hard-kill the emulator process if preserving local state matters.

Known local admin emulator user:

- Email: `admin@gmail.com`
- Password: `admin123`
- Claims: `{ admin: true, role: "admin" }`

Helper created:

- `migration/bin/ensure_emulator_admin_user.js`

## Firestore And SSR Data Loading

The app originally tried Firebase Server App user-context reads during SSR and then fell back to Admin SDK reads. In local emulator/dev and admin sessions, that produced slow page loads because Firestore rules denied the user-context read first:

- `permission-denied` on `students`
- `permission-denied` on `payoutRecords`

Decision:

- In `APP_ENV=dev`, skip user-context Firestore probes and go straight to Admin-backed repositories.
- For admin sessions, also skip user-context probes.
- This avoids paying for a failed rules check before the real load.

Relevant file:

- `apps/sis-next/app/lib/server/app-data.ts`

Also important:

- SSR Firestore user-context reads were moved to `firebase/firestore/lite` to avoid the heavier `grpc/protobuf` path and related warnings.

## Backend Migration

Callable functions and direct client Firestore access were migrated into Next backend APIs.

Primary backend API areas:

- `/api/students`
- `/api/trash`
- `/api/users`
- `/api/options/[collection]`
- `/api/school-courses`
- `/api/payout-records`
- `/api/auth/session`

Old import/seed APIs still exist but are no longer exposed in the UI:

- `/api/import/batch-options`
- `/api/seed/firestore`

Unless explicitly requested, avoid re-exposing Import or Seed controls in the app.

## UI And Routing Decisions

Early migration used a single client shell with local `activeView`. It was converted to real App Router pages.

Important stability decision:

- Dynamic `[view]` route caused repeated dev-server vendor chunk errors.
- It was replaced with explicit route pages and shared `app/view-page.tsx`.

Known stale Next dev errors:

- Missing `.next/server/vendor-chunks/@grpc.js`
- Missing `.next/server/vendor-chunks/@opentelemetry.js`
- Missing `.next/server/vendor-chunks/lucide-react.js`
- Browser `Cannot read properties of undefined (reading 'call')`

When these appear after code changes:

1. Stop the Next dev server.
2. Remove `apps/sis-next/.next`.
3. Restart the dev server.

These have been stale build artifact issues, not direct evidence of compromise.

## Removed Or Renamed Product Areas

Removed from nav/UI:

- Import
- Payout Records
- Setup

Renamed:

- Exports -> Payrolls

Kept as redirects:

- `/exports` -> `/payrolls`
- `/setup` -> `/catalogs`

Catalogs:

- Barangays
- Schools
- Courses
- Batches

`Setup` used to contain school-course mappings. That separate Setup tab was removed. Be careful before reintroducing it; the current desired product shape is simpler.

## Student Data Model Decisions

Removed from student model/UI:

- Generic `status`
- `academic_status`

Current student state should be expressed through operational flags:

- `claimed`
- `renewed`
- `payrolled`

Do not reintroduce broad fake status fields unless the user explicitly changes the domain model.

## Payroll Domain Rules

Payroll is a document-bound government workflow. Treat it as stricter than normal UI flags.

Key rule:

- Payroll state should be changed through `/payrolls`, because payroll changes are bound to generated files and signed government documents.
- Do not expose manual `Mark Payrolled` actions in `/records`.

Current Payrolls behavior:

- Route: `/payrolls`
- Former `All Students` tab is now `No Payrolled Students`.
- `No Payrolled Students` shows students where `payrolled !== true`.
- `Renewed Students` shows students where `renewed === true`.

Each tab has its own Payroll Controls.

Creating payroll from `No Payrolled Students`:

- Generates payroll files.
- Marks selected students `renewed: true`.
- Marks selected students `payrolled: true`.
- Saves payroll trace records with `type: "new_student_payroll"`.

Creating payroll from `Renewed Students`:

- Generates payroll files.
- Marks selected students `payrolled: true`.
- Saves payroll trace records with `type: "renewed_student_payroll"`.

Payroll records are stored in the existing `payoutRecords` collection for compatibility, but are now used as payroll trace records.

Added payroll record fields:

- `payroll_id`
- `payroll_group_count`
- `payroll_student_count`

Important conceptual distinction:

- `renewed` is a student renewal state.
- `payrolled` indicates the student has been included in a generated payroll.
- Payroll trace records are history, not the source of whether a student is renewed.

## Records Page Decisions

`/records` is a student lookup and review surface, not the place where payroll state mutates.

Current table behavior:

- Shows payroll count per student immediately.
- Shows total payroll amount per student.
- Has one `Actions` button per row.

Record Actions dialog:

- Edit Student
- Show Payroll History
- Move To Trash for admins

Removed from Record Actions:

- Mark Claimed
- Mark Payrolled

Reason:

- Payroll changes must happen through `/payrolls`.
- Claim/payroll flags should not be casually toggled from records when they are tied to formal documents.

Payroll History Lookup:

- `/records` includes a lookup section for payroll traces by student.
- It reads from `payoutRecords`.

## React Event Bug Pattern

Several crashes came from reading `event.currentTarget.value` or `.checked` inside state updater closures after React had nulled the event object.

Fix pattern:

```tsx
onChange={(event) => {
  const value = event.currentTarget.value;
  setState((current) => ({ ...current, value }));
}}
```

Use the same pattern for checkboxes:

```tsx
const checked = event.currentTarget.checked;
```

Do not read `event.currentTarget` inside a delayed updater.

## Build Verification

Use:

```bash
npm run build
```

from:

```text
apps/sis-next
```

The build has been used as the main verification step after each migration change.

## Future Agent Directives

1. Prefer `apps/sis-next` for new implementation.
2. Use `public/` only as a legacy behavior reference.
3. Do not reintroduce removed navigation areas unless explicitly requested.
4. Keep Payrolls as the only place that mutates payrolled state.
5. Preserve payroll trace records for audit/history.
6. Keep `encoder` as the non-admin role name.
7. Treat `.next` vendor chunk errors as likely stale build artifacts first.
8. For Firestore work, be careful with SSR user-context reads because rules failures can cause slow fallback behavior.
9. Keep admin-only actions guarded both in UI and backend where possible.
10. Run `npm run build` after meaningful changes.
