<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditUserActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if ($request->user() && in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true) && ! $request->routeIs('login.store', 'logout')) {
            $routeName = $request->route()?->getName() ?: $request->method().' '.$request->path();
            $safeKeys = collect($request->except(['_token', '_method', 'password', 'password_confirmation']))
                ->keys()->take(100)->values()->all();

            ActivityLog::record($request, $routeName, null, ['input_keys' => $safeKeys], $response->getStatusCode());
        }

        return $response;
    }
}
