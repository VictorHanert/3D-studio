<?php

namespace App\Http\Controllers;

use App\Models\UserConfiguration;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    use AuthorizesRequests;

    /**
     * Store a new configuration for the authenticated user
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'configuration_data' => 'required|array',
        ]);

        try {
            $configuration = $request->user()->configurations()->create([
                'name' => $validated['name'],
                'configuration_data' => $validated['configuration_data'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Configuration saved successfully',
                'configuration' => $configuration,
            ], 201);
        } catch (\Exception $error) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save configuration: '.$error->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all configurations for the authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $configurations = $request->user()->configurations()
            ->latest('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'configurations' => $configurations,
        ]);
    }

    /**
     * Get a specific configuration
     */
    public function show(UserConfiguration $configuration): JsonResponse
    {
        $this->authorize('view', $configuration);

        return response()->json([
            'success' => true,
            'configuration' => $configuration,
        ]);
    }

    /**
     * Delete a configuration
     */
    public function destroy(UserConfiguration $configuration): JsonResponse
    {
        $this->authorize('delete', $configuration);

        try {
            $configuration->delete();

            return response()->json([
                'success' => true,
                'message' => 'Configuration deleted successfully',
            ]);
        } catch (\Exception $error) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete configuration: '.$error->getMessage(),
            ], 500);
        }
    }

    /**
     * Load configuration by share code (public endpoint)
     */
    public function loadByShareCode(string $code): JsonResponse
    {
        $configuration = UserConfiguration::where('share_code', $code)->first();

        if (! $configuration) {
            return response()->json([
                'success' => false,
                'message' => 'Configuration not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'configuration' => $configuration,
        ]);
    }
}
