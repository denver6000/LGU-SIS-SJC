<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentHistory extends Model
{
    protected $table = 'student_history';

    protected $fillable = [
        'student_id', 'user_id', 'academic_cycle_id', 'history_type', 'action',
        'summary', 'old_values', 'new_values',
    ];

    protected function casts(): array
    {
        return ['old_values' => 'array', 'new_values' => 'array'];
    }

    public function student(): BelongsTo { return $this->belongsTo(Student::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function academicCycle(): BelongsTo { return $this->belongsTo(AcademicCycle::class); }
}
