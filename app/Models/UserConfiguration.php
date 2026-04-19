<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class UserConfiguration extends Model
{
    protected $fillable = [
        'name',
        'configuration_data',
        'share_code',
    ];

    protected function casts(): array
    {
        return [
            'configuration_data' => 'array',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Model $model) {
            if (! $model->share_code) {
                $model->share_code = Str::random(8);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
