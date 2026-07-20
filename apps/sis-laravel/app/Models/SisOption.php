<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SisOption extends Model
{
    protected $table = 'sis_options';
    protected $fillable = ['collection_name', 'source_id', 'name', 'added_at'];
    protected function casts(): array { return ['added_at' => 'datetime']; }
}
