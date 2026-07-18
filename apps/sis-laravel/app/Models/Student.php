<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends Model
{
    protected $fillable = ['student_id', 'full_name', 'payout_track', 'student_number', 'barangay', 'address', 'phone_number'];

    public function cycles(): HasMany { return $this->hasMany(StudentCycle::class); }
}
