import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { ModelData } from '@/system/utilities/types';
import { SpawnManager } from '@/system/managers/SpawnManager';

function createBlockingModel(id: string, halfExtent: number): ModelData {
    const object = new THREE.Group();
    object.position.set(0, 0, 0);

    const bounds = {
        box: new THREE.Box3(
            new THREE.Vector3(-halfExtent, 0, -halfExtent),
            new THREE.Vector3(halfExtent, halfExtent * 2, halfExtent)
        ),
        size: new THREE.Vector3(halfExtent * 2, halfExtent * 2, halfExtent * 2),
    };

    return {
        id,
        modelKey: id,
        object,
        bounds,
        cachedBounds: bounds.box.clone(),
        path: `/models/${id}.glb`,
        meshes: [],
    } as ModelData;
}

describe('SpawnManager spiral limits', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('falls back to a controlled position after exhausting spiral attempts', () => {
        const blocker = createBlockingModel('blocking-volume', 100);
        const models = ref<ModelData[]>([blocker]);
        const manager = new SpawnManager(models);
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = manager.findSpawnPosition(new THREE.Vector3(2, 2, 2));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'SpawnManager: No valid spawn position found, placing far from origin'
        );
        expect(result.x).toBe(5);
        expect(result.y).toBe(0);
        expect(result.z).toBe(0);
    });

    it('returns origin immediately when it is collision free', () => {
        const models = ref<ModelData[]>([]);
        const manager = new SpawnManager(models);
        const generateSpiralSpy = vi.spyOn(manager as any, 'generateSpiralPosition');

        const result = manager.findSpawnPosition(new THREE.Vector3(2, 2, 2));

        expect(result).toEqual(new THREE.Vector3(0, 0, 0));
        expect(generateSpiralSpy).not.toHaveBeenCalled();
    });

    it('returns a valid candidate discovered on the maximum spiral attempt', () => {
        const models = ref<ModelData[]>([]);
        const manager = new SpawnManager(models);

        const generateSpiralSpy = vi
            .spyOn(manager as any, 'generateSpiralPosition')
            .mockImplementation((attempt: number) => new THREE.Vector3(attempt, 0, -attempt));

        const isPositionValidSpy = vi
            .spyOn(manager as any, 'isPositionValid')
            .mockImplementation((position: THREE.Vector3) => position.x === 100);

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = manager.findSpawnPosition(new THREE.Vector3(1, 1, 1));

        expect(result).toEqual(new THREE.Vector3(100, 0, -100));
        expect(isPositionValidSpy).toHaveBeenCalledTimes(101);
        expect(generateSpiralSpy).toHaveBeenCalledTimes(100);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
});