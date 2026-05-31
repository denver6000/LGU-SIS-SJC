# Codex Continuation Notes

Last updated: 2026-06-01

Use this as a directive when continuing this project as Codex. The main session memory is in `docs/session/agents.md`; this file highlights the decisions most likely to matter during implementation.

## Working Style For This Repo

Read before editing. This project changed rapidly during migration, and `apps/sis-next/app/app-shell.tsx` carries a lot of behavior. Use `rg` and focused reads before touching it.

Prefer small, direct edits. The user is actively shaping product behavior, so avoid broad refactors unless the request asks for them or the file becomes impossible to maintain.

Run builds from:

```text
apps/sis-next
```

Command:

```bash
npm run build
```

## Product Rules To Preserve

The app is now the Next.js app under `apps/sis-next`. Do not put new product logic back into `public/` or `functions/` unless the user explicitly asks.

Visible pages:

- Dashboard
- Catalogs
- Registry
- Renewal
- Records
- Users
- Payrolls
- Trash

Removed from visible navigation:

- Import
- Payout Records
- Setup

Redirects:

- `/exports` redirects to `/payrolls`.
- `/setup` redirects to `/catalogs`.

## Payroll Is Strict

Payrolls are tied to generated government documents. Do not casually mutate payroll state from records.

Only `/payrolls` should create payroll files and set `payrolled: true`.

`/records` may show payroll history, counts, and totals, but should not include manual `Mark Payrolled` or `Mark Claimed` controls in Record Actions.

Current Payrolls behavior:

- `No Payrolled Students`: students with `payrolled !== true`
- `Renewed Students`: students with `renewed === true`

Creating payroll from `No Payrolled Students`:

- Generate payroll files.
- Set selected students `renewed: true`.
- Set selected students `payrolled: true`.
- Save payroll trace records with `type: "new_student_payroll"`.

Creating payroll from `Renewed Students`:

- Generate payroll files.
- Set selected students `payrolled: true`.
- Save payroll trace records with `type: "renewed_student_payroll"`.

Payroll traces currently use `payoutRecords` for compatibility.

## Records Page

Records must immediately show payroll count and total payroll amount per student.

Record Actions dialog should remain uncluttered:

- Edit Student
- Show Payroll History
- Move To Trash for admins

Payroll History Lookup is in `/records` and reads from payroll trace records.

## Auth And Roles

Non-admin role is `encoder`.

Legacy `user` claims are recognized only for compatibility. New users should get:

```json
{ "role": "encoder", "encoder": true }
```

Admin users should get:

```json
{ "role": "admin", "admin": true }
```

The emulator admin user is:

- `admin@gmail.com`
- `admin123`

## Emulator And `.env.local`

`APP_ENV=dev` in `apps/sis-next/.env.local` drives emulator use.

Server reads `process.env.APP_ENV`.

Client gets the mirrored public value through Next config.

Expected emulator ports:

- Firestore: `127.0.0.1:8080`
- Auth: `127.0.0.1:9099`

## Firestore SSR Caution

The SSR loader once attempted user-context Firebase Server App reads first. In emulator/dev and admin sessions this caused permission-denied roundtrips before Admin fallback.

Current choice:

- Dev/admin SSR data loading should go straight to Admin-backed repository reads.

Do not reintroduce slow user-context probes without a strong reason.

## Known Next Dev Cache Failure

If the dev server throws missing vendor chunks such as:

- `lucide-react.js`
- `@grpc.js`
- `@opentelemetry.js`

then the likely fix is:

1. Stop dev server.
2. Delete `apps/sis-next/.next`.
3. Restart dev server.

This has repeatedly been stale local build output.

## React Event Handler Rule

Never use `event.currentTarget.value` or `event.currentTarget.checked` inside a state updater closure. Capture it first.

Good:

```tsx
onChange={(event) => {
  const value = event.currentTarget.value;
  setDraft((current) => ({ ...current, role: value }));
}}
```

Same for checkbox `checked`.

## Removed Fields

Do not reintroduce:

- student `status`
- `academic_status`

Use real operational flags:

- `claimed`
- `renewed`
- `payrolled`

## Files Most Often Touched

- `apps/sis-next/app/app-shell.tsx`
- `apps/sis-next/app/globals.css`
- `apps/sis-next/app/lib/shared/views.ts`
- `apps/sis-next/app/lib/server/app-data.ts`
- `apps/sis-next/app/lib/shared/payout-record.ts`
- `apps/sis-next/app/lib/server/repositories/payout-records.ts`

## Before Final Response

After implementation, summarize:

- what changed
- why it changed if architectural
- verification result

Keep the final concise and practical.
