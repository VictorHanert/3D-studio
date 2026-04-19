<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class EditorController extends Controller
{
    /**
     * Display the 3D furniture editor.
     */
    public function index(): Response
    {
        return Inertia::render('Editor');
    }
}
