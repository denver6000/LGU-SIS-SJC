<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id', 'action', 'method', 'route_name', 'route_uri', 'url', 'status_code',
        'ip_address', 'user_agent', 'target_type', 'target_id', 'description', 'metadata',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(Request $request, string $action, ?string $description = null, ?array $metadata = null, ?int $statusCode = null): self
    {
        $route = $request->route();
        $parameters = [];
        $targetType = null;
        $targetId = null;

        if ($route) {
            foreach ($route->parameters() as $name => $parameter) {
                if ($parameter instanceof Model) {
                    $parameters[$name] = $parameter->getKey();
                    $targetType ??= $parameter::class;
                    $targetId ??= (string) $parameter->getKey();
                } else {
                    $parameters[$name] = is_scalar($parameter) ? (string) $parameter : get_debug_type($parameter);
                }
            }
        }

        return static::create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'method' => $request->method(),
            'route_name' => $route?->getName(),
            'route_uri' => $route?->uri(),
            'url' => $request->fullUrl(),
            'status_code' => $statusCode,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'target_type' => $targetType,
            'target_id' => $targetId,
            'description' => $description ?? static::defaultDescription($action),
            'metadata' => array_merge(['route_parameters' => $parameters], $metadata ?? []),
        ]);
    }

    private static function defaultDescription(string $action): string
    {
        return str($action)->replace(['.', '_', '-'], ' ')->title()->toString();
    }
}
