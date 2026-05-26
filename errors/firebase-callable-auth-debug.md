# Firebase Callable Auth Debug

## Scope

This note documents the debugging trail for `SamStaticFirebase` admin callable failures, especially `createManagedUser`.

Relevant project files:

- [public/js/store.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/store.js:1)
- [public/js/app.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/app.js:1)
- [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:1)
- [public/firebase-config.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/firebase-config.js:1)
- [.firebaserc](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/.firebaserc:1)

## Initial Symptoms

- Admin was able to sign in successfully through Firebase Auth.
- The hosted static site loaded normally and admin-only UI was visible.
- `listManagedUsers` succeeded from the Users page.
- `createManagedUser` failed consistently from the same signed-in admin session.
- The client originally showed a generic modal/message:

```text
Firebase Functions returned an internal error. If you recently changed functions, deploy them and try again.
```

- Browser console repeatedly showed:

```text
[SamAuthDebug] callable-failure:createManagedUser
{ code: "functions/internal", message: "internal", details: "", customMessage: "" }
```

## Errors Encountered

### 1. Generic callable failure in the browser

Observed:

```text
functions/internal
message: internal
details: ""
```

Meaning:

- The browser reached the callable layer.
- The callable response came back as a generic internal failure with no useful detail.

### 2. Cloud Run unauthenticated request warning

Observed in Firebase/GCP logs:

```text
The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header.
Empty Authorization header value.
```

Log source:

- `projects/lgus-sjc-scholarship/logs/run.googleapis.com%2Frequests`

Meaning:

- A request to the Cloud Run service behind the callable was rejected before the function logic could meaningfully process it.

### 3. Browser extension noise

Observed:

- `notifications.bitwarden.com/hub`
- `SignalR`
- `Attempting to use a disconnected port object`
- `No tab with id`
- `bootstrap-autofill-overlay.js`
- `runtime.lastError ... moved into back/forward cache ...`

Diagnosis:

- These are from the Bitwarden browser extension and Chrome extension messaging/BFCache behavior.
- They are not part of the Firebase app failure.

## Initial Diagnoses Considered

### Hypothesis A: The app was calling raw HTTP function URLs

Why it was considered:

- Cloud Run logs mentioned unauthenticated request handling.
- That often happens when someone uses direct `fetch()` to the service URL instead of the Firebase callable SDK.

What was checked:

- [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:5) uses `onCall(...)`, not `onRequest(...)`.
- [public/js/store.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/store.js:167) uses `httpsCallable(...)`.
- No raw `fetch()` calls to function URLs were found in the static app.

Conclusion:

- Rejected. The client is already using Firebase callable semantics.

### Hypothesis B: Missing custom claims

Why it was considered:

- Admin-only functions rely on `request.auth.token.role === "admin"` or `admin === true`.

What was checked:

- Client auth diagnostics showed:
  - signed in user present
  - role resolved as `admin`
  - `claimsRole: "admin"`
  - `admin: true`
- `listManagedUsers` succeeded under the same session.

Conclusion:

- Rejected as the primary issue.
- If claims were missing, `assertAdmin(...)` should have produced a permission error, not an earlier unauthenticated Cloud Run warning.

### Hypothesis C: Region mismatch

Why it was considered:

- Callable failures can happen if client and function region differ.

What was checked:

- Client uses `getFunctions(app, "asia-southeast1")` in [public/js/store.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/store.js:62).
- Functions use `setGlobalOptions({ region: "asia-southeast1" })` in [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:9).

Conclusion:

- Rejected.

### Hypothesis D: Stale browser bundle

Why it was considered:

- The browser was initially still showing old client code paths.

What was done:

- Cache-busting import tags were bumped in [public/js/app.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/app.js:35).

Conclusion:

- This was a real issue once, but after refreshes the new `SamAuthDebug` logs were clearly present, so it is not the remaining root cause.

## Diagnostics Added

### Client-side diagnostics

Added in [public/js/store.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/store.js:21):

- `firebase-runtime-ready`
- `auth-state-changed`
- `sign-in-start`
- `sign-in-success`
- `callable-start:<name>`
- `callable-success:<name>`
- `callable-failure:<name>`

Added in [public/js/app.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/app.js:153):

- `auth-session-ready`
- `set-auth-ui`
- `set-view`
- `refresh-start`
- `refresh-success`

### Error surfacing changes

Client error normalization was improved so Firestore, Functions, and Auth failures appear in the feedback modal instead of only the console.

Relevant locations:

- [public/js/store.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/store.js:74)
- [public/js/app.js](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/public/js/app.js:304)

### Server-side managed user error mapping

Added Admin SDK error mapping in [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:100) so the following should become user-facing callable errors after deploy:

- duplicate email
- invalid email
- invalid password
- user not found
- insufficient permission

Functions were rebuilt locally with `npm run build`.

## What the Logs Proved

The following sequence was observed from the same admin session:

1. `firebase-runtime-ready`
2. `auth-state-changed` with:
   - `signedIn: true`
   - admin UID present
   - `claimsRole: "admin"`
   - `admin: true`
3. `auth-session-ready`
4. `refresh-start`
5. `callable-start:listManagedUsers`
6. `callable-success:listManagedUsers`
7. `refresh-success`
8. `callable-start:createManagedUser`
9. `callable-failure:createManagedUser` with:
   - `code: "functions/internal"`
   - `message: "internal"`

Implications:

- Firebase Auth works in the browser.
- Claims are present.
- Callable transport works at least for `listManagedUsers`.
- The remaining failure is specific to `createManagedUser` or the Cloud Run service/IAM path behind it.

## Current Strongest Diagnosis

The strongest remaining diagnosis is:

- `createManagedUser` is being blocked or mishandled at the Cloud Run service/IAM layer before meaningful callable error details make it back.

Why this is currently strongest:

- `listManagedUsers` works from the same signed-in admin session.
- `createManagedUser` does not.
- Cloud Run logs show:
  - empty authorization header
  - unauthenticated request warning
- This suggests a per-function runtime/service configuration issue, or a deploy inconsistency, rather than a general Firebase Auth or claims failure.

## Resolution Applied On 2026-05-26

The Cloud Run invoker layer was the blocker.

Changes applied:

- Added explicit `invoker: "public"` callable options in [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:18).
- Rebuilt Functions with `npm run build`.
- Deployed Functions to `lgus-sjc-scholarship` with `firebase deploy --only functions`.
- Added `roles/run.invoker` for `allUsers` on the callable Cloud Run services in `asia-southeast1`.

Services updated:

- `createmanageduser`
- `listmanagedusers`
- `deletemanageduser`
- `updatemanageduser`
- `savestudentbyadmin`
- `updatestudentbyadmin`
- `movestudenttotrashbyadmin`
- `restorestudentbyadmin`
- `deletetrashstudentbyadmin`

Verification:

```text
POST https://asia-southeast1-lgus-sjc-scholarship.cloudfunctions.net/createManagedUser
```

without Firebase Auth now returns the callable function's own response:

```json
{"error":{"message":"You must be signed in to use this function.","status":"UNAUTHENTICATED"}}
```

That confirms the request is reaching `createManagedUser` instead of being rejected by Cloud Run before the function runs. Browser calls from a signed-in admin should now pass the transport/IAM layer and be authorized by `assertAdmin(...)`.

## Solutions Already Attempted

### Implemented

- Added modal-based global error reporting.
- Added backend error normalization in the browser.
- Added verbose auth/callable debug logging.
- Bumped client asset version tags to avoid stale cache.
- Added server-side Admin SDK error mapping for managed-user functions.
- Rebuilt the Functions bundle locally.

### Not Yet Confirmed

- Whether the updated Functions code with improved error mapping has been deployed successfully and is the exact code currently serving `createManagedUser`.
- Whether the Cloud Run service for `createManagedUser` has the same invoker/IAM behavior as the working `listManagedUsers` service.

## Recommended Next Steps For The Next Agent

1. Verify the deployed `createManagedUser` function is the latest code from [functions/src/index.ts](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/functions/src/index.ts:183).
2. Compare Cloud Run/IAM/invoker settings between:
   - `createManagedUser`
   - `listManagedUsers`
3. Add explicit server-side `logger.error(...)` around managed-user operations if more raw Admin SDK detail is needed.
4. Re-test after deploy and inspect Firebase function execution logs, not just browser console logs.
5. If needed, confirm that the Firebase project in [.firebaserc](c:/Users/giyut/Documents/ProjectsForOtherPeeps/SamWebsite/SamStaticFirebase/.firebaserc:1) is the same project receiving the hosted traffic and function invocations.

## Notes

- The Bitwarden extension logs were investigated via web search and are consistent with known extension behavior, not the Firebase app itself.
- No work should be done in `web2` unless explicitly requested.
