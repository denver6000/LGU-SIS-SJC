<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sis_options')) return;

        Schema::create('sis_options', function (Blueprint $table) {
            $table->id();
            $table->string('collection_name', 50);
            $table->string('source_id');
            $table->string('name');
            $table->timestamp('added_at')->nullable();
            $table->timestamps();
            $table->unique(['collection_name', 'source_id']);
            $table->unique(['collection_name', 'name']);
        });
    }

    public function down(): void { Schema::dropIfExists('sis_options'); }
};
