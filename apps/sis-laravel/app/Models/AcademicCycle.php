<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicCycle extends Model
{
    protected $fillable = ['school_year', 'semester_number', 'status'];

    public function studentCycles(): HasMany { return $this->hasMany(StudentCycle::class); }

    public function label(): string
    {
        return $this->school_year.' / '.($this->semester_number === 1 ? '1st' : '2nd').' Semester';
    }
}
