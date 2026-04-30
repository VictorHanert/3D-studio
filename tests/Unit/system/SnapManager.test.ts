import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import snapConfig from '../../../public/config/snap-config.json';
import type { ModelData } from '@/system/utilities/types';
import { SnapManager } from '@/system/managers/SnapManager';

function createModel(modelKey: string, positionX: number, rotationY: number): ModelData {
    const object = new THREE.Group();
    object.position.set(positionX, 0, 0);
    object.rotation.set(0, rotationY, 0);

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

function createConfig() {
    return {
        defaultSnapDistance: 0.5,
        models: {
            MOVE: {
                points: [{ id: 'move-right', side: 'right', type: 'armrest_right', depthSide: 'back' }],
            },
            TARGET_A: {
                points: [{ id: 'target-left', side: 'left', type: 'armrest_left', depthSide: 'back' }],
            },
            TARGET_B: {
                points: [{ id: 'target-left', side: 'left', type: 'armrest_left', depthSide: 'back' }],
            },
        },
        rules: [
            { typeA: 'armrest_right', typeB: 'armrest_left', snapDistance: 0.5 },
        ],
    };
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
            createModel('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', 0, 0),
            createModel('CONNECT_MODULAR_SOFA_RIGHT_ARMREST_B', 0, 0)
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
            createModel('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', 0, 0),
            createModel('RANDOM_OBJECT', 0, 0)
        )).toBe(false);
    });

    it('chooses the closest valid snap point when multiple candidates exist', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const candidate = new THREE.Vector3(0, 0, 0);
        const closeTarget = createModel('TARGET_A', 2.2, 0);
        const farTarget = createModel('TARGET_B', 2.4, 0);

        const snapped = manager.getSnappedPosition(moving, candidate, [closeTarget, farTarget]);

        expect(snapped.x).toBeCloseTo(0.2);
    });

    it('rejects a snap when rotation exceeds the tolerance and accepts it when inside tolerance', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const candidate = new THREE.Vector3(0, 0, 0);
        const overTolerance = createModel('TARGET_A', 2.2, 0.11);
        const underTolerance = createModel('TARGET_A', 2.2, 0.09);

        expect(manager.getSnappedPosition(moving, candidate, [overTolerance])).toEqual(candidate);

        const accepted = manager.getSnappedPosition(moving, candidate, [underTolerance]);
        expect(accepted).not.toEqual(candidate);
        expect(accepted.x).toBeGreaterThan(0);
    });
});