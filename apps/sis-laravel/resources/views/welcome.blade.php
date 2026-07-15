<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Scholarship Management System') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <main class="welcome-shell">
        <section class="welcome-card" aria-labelledby="app-title">
            <p class="eyebrow">Laravel migration scaffold</p>
            <h1 id="app-title">Scholarship Management System</h1>
            <p class="intro">
                The Laravel foundation is ready. Requirements, qualifications, and payroll history will remain explicit records
                managed by authorized users.
            </p>
            <div class="welcome-grid">
                <div>
                    <span>Database direction</span>
                    <strong>SQL, relational records</strong>
                </div>
                <div>
                    <span>Current phase</span>
                    <strong>Foundation and requirements design</strong>
                </div>
            </div>
        </section>
    </main>
</body>
</html>
