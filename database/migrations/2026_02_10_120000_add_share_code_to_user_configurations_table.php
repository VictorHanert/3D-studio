<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_configurations', function (Blueprint $table) {
            $table->string('share_code')->nullable()->after('configuration_data');
        });

        // Generate unique share codes for existing records
        $configurations = DB::table('user_configurations')->whereNull('share_code')->get();
        foreach ($configurations as $config) {
            DB::table('user_configurations')
                ->where('id', $config->id)
                ->update(['share_code' => Str::random(8)]);
        }

        // Make share_code unique
        Schema::table('user_configurations', function (Blueprint $table) {
            $table->unique('share_code');
        });
    }

    public function down(): void
    {
        Schema::table('user_configurations', function (Blueprint $table) {
            $table->dropUnique(['share_code']);
            $table->dropColumn('share_code');
        });
    }
};
