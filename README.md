# Sam Static Firebase

Static Firebase Hosting version of the student information system.

This project is intentionally separate from `web2`; it has no Flask dependency, no Jinja templates, and no server-side flash/session behavior.

## Setup

1. Firebase project id is set in `.firebaserc`.
2. Firebase web config is set in `public/firebase-config.js`.
3. Create the Firestore database in Firebase Console for project `lgus-sjc-scholarship`.
4. Deploy Firestore rules only after reviewing `firestore.rules`; the current rules are open because authentication is deferred.
4. Run locally with any static server, for example:

```powershell
python -m http.server 5173 -d public
```

5. Open `http://localhost:5173`.

## Seed Data

The current JSON data was copied into:

- `public/data/student_data.seed.json`
- `public/data/trash_data.seed.json`
- `public/data/schools_courses.seed.json`
- `public/data/batch_options.seed.json`

`BATCH 1-7.xlsx` is used only to derive option collections. The browser app loads unique barangays, schools, and batches from `batch_options.seed.json`; it does not import student rows from the workbook.

To upload the smaller legacy seed records into Firestore manually, run:

```powershell
node scripts/seed-firestore.mjs
```

If seeding returns `database (default) does not exist`, create the Firestore database first in Firebase Console.

## Collections

- `students`
- `trash`
- `schoolCourses`
- `payoutRecords`
- `barangays`
- `schools`
- `courses`
- `batches`
