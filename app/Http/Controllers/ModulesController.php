<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

class ModulesController extends Controller
{
    /**
     * Get available modules and materials.
     */
    public function index()
    {
        return Cache::remember('modules_data', 3600, function () {
            $modelsPath = public_path('models');
            $modules = [];
            $materialsMap = collect();

            if (! File::isDirectory($modelsPath)) {
                return ['modules' => [], 'materials' => []];
            }

            $folders = File::directories($modelsPath);

            foreach ($folders as $folderPath) {
                $folderName = basename($folderPath);

                // Get materials specific to this module folder and also populate global materials map
                $moduleMaterials = $this->extractMaterials($folderPath, $materialsMap);

                $modules[] = [
                    'name' => $this->formatModuleName($folderName),
                    'folder' => $folderName,
                    'thumbnail' => null,
                    'materials' => $moduleMaterials,
                ];
            }

            // Sort modules by name
            usort($modules, fn ($a, $b) => strcmp($a['name'], $b['name']));

            // Convert materials map to array and sort
            $materials = $materialsMap->map(fn ($filename, $material) => [
                'name' => $material,
                'defaultFile' => $filename,
            ])
                ->sortBy('name')
                ->values()
                ->all();

            return [
                'modules' => $modules,
                'materials' => $materials,
            ];
        });
    }

    /**
     * Format folder name to readable module name.
     */
    private function formatModuleName(string $folderName): string
    {
        // Remove CONNECT_MODULAR_SOFA_ prefix if present
        $name = str_replace('CONNECT_MODULAR_SOFA_', '', $folderName);

        // Convert underscores to spaces
        $name = str_replace('_', ' ', $name);

        // Handle hyphenated parts (e.g., "OPEN-ENDED" stays together)
        return ucwords($name);
    }

    /**
     * Extract material names from GLB filenames in a folder.
     */
    private function extractMaterials(string $folderPath, $materialsMap): array
    {
        $files = File::glob($folderPath.'/*.glb');
        $moduleMaterials = [];

        foreach ($files as $file) {
            $filename = basename($file);
            $base = basename($file, '.glb');
            $parts = explode(' ', $base);

            if (count($parts) >= 2) {
                // Remove the last part (variant number) to get the material name
                array_pop($parts);
                $materialRaw = implode(' ', $parts);
            } else {
                $materialRaw = $base; // Fallback
            }

            $material = ucwords(strtolower($materialRaw));

            // Add to module-specific list if not already present
            $exists = false;
            foreach ($moduleMaterials as $m) {
                if ($m['name'] === $material) {
                    $exists = true;
                    break;
                }
            }
            if (! $exists) {
                $moduleMaterials[] = ['name' => $material, 'file' => $filename];
            }

            // Populate global materials map (first encountered file per material)
            if (! $materialsMap->has($material)) {
                $materialsMap->put($material, $filename);
            }
        }

        return $moduleMaterials;
    }
}
