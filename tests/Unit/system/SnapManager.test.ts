import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import snapConfig from '../../../public/config/snap-config.json';
import type { ModelData } from '@/system/utilities/types';
import { SnapManager } from '@/system/managers/SnapManager';

function createModel(modelKey: string): ModelData {
    const object = new THREE.Group();
    const bounds = {
        box: new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 1, 1)
        ),
        size: new THREE.Vector3(2, 1, 2),
    };

    return {
        id: `${modelKey}-id`,
        modelKey,
        object,
        bounds,
        cachedBounds: bounds.box.clone(),
        path: `/models/${modelKey}.glb`,
        meshes: [],
    } as ModelData;
}

describe('SnapManager domain rules', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true for compatible sofa modules from the snap config', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => snapConfig,
        } as Response);

        await manager.loadConfig();

        expect(manager.checkCompatibility(
            createModel('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A'),
            createModel('CONNECT_MODULAR_SOFA_RIGHT_ARMREST_B')
        )).toBe(true);
    });

    it('returns false for incompatible modules', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => snapConfig,
        } as Response);

        await manager.loadConfig();

        expect(manager.checkCompatibility(
            createModel('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A'),
            createModel('RANDOM_OBJECT')
        )).toBe(false);
    });
});