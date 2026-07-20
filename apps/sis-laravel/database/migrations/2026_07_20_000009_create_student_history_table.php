<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('academic_cycle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('history_type');
            $table->string('action');
            $table->string('summary');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'history_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_history');
    }
};
