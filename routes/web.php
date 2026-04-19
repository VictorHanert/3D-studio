<?php

use App\Http\Controllers\ConfigurationController;
use App\Http\Controllers\EditorController;
use App\Http\Controllers\ModulesController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

// Public API routes
Route::get('/api/modules', [ModulesController::class, 'index']);
Route::get('/api/configurations/share/{code}', [ConfigurationController::class, 'loadByShareCode']);

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/editor', [EditorController::class, 'index'])->name('editor');
    Route::post('/api/configurations', [ConfigurationController::class, 'store']);
    Route::get('/api/configurations', [ConfigurationController::class, 'index']);
    Route::get('/api/configurations/{configuration}', [ConfigurationController::class, 'show']);
    Route::delete('/api/configurations/{configuration}', [ConfigurationController::class, 'destroy']);
});
