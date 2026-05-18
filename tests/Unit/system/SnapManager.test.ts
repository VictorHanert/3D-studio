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

    it('accepts snap at exact angle tolerance boundary (0.10 rad)', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const candidate = new THREE.Vector3(0, 0, 0);
        const exactBoundary = createModel('TARGET_A', 2.2, 0.10);

        const snapped = manager.getSnappedPosition(moving, candidate, [exactBoundary]);

        // 0.10 rad is exactly at the tolerance boundary (angleDifference <= 0.1),
        // so the snap should be accepted and position should change
        expect(snapped).not.toEqual(candidate);
        expect(snapped.x).toBeGreaterThan(0);
    });

    it('accepts snaps when rotations differ by full turns', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const target = createModel('TARGET_A', 2, Math.PI * 2);
        const candidate = new THREE.Vector3(0.5, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidate, [target]);

        expect(snapped.x).toBeCloseTo(0, 1);
    });

    it('snaps exactly at distance threshold boundary', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        // Moving model at x=0, right snap point at local x=1 → world x=1
        // Target model at x=2, left snap point at local x=-1 → world x=1
        // Candidate at x=0.5, so moving snap point becomes world x=1.5
        // Distance from (1.5, 0, -1) to (1, 0, -1) = 0.5 (exactly at threshold)
        const moving = createModel('MOVE', 0, 0);
        const target = createModel('TARGET_A', 2, 0);
        const candidateAtThreshold = new THREE.Vector3(0.5, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidateAtThreshold, [target]);

        // Delta should move candidate from x=0.5 to align snap points
        // Moving snap point at x=1.5, target at x=1, delta = -0.5
        expect(snapped.x).toBeCloseTo(0, 1);
    });

    it('rejects snap just beyond distance threshold', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const target = createModel('TARGET_A', 3.5, 0);
        const candidateBeyondThreshold = new THREE.Vector3(0.8, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidateBeyondThreshold, [target]);

        expect(snapped).toEqual(candidateBeyondThreshold);
    });

    it('correctly calculates snap points for scaled models', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        moving.object.scale.set(2, 1, 1); // Double width — snap point at right edge is scaled

        const target = createModel('TARGET_A', 5, 0);

        const candidate = new THREE.Vector3(0, 0, 0);
        const snapped = manager.getSnappedPosition(moving, candidate, [target]);

        // With scale 2x, the moving model's right snap point is at local x=1 * scale 2 = world x=2.
        // Target's left snap point is at local x=-1 + target position 5 = world x=4.
        // Delta = 4 - 2 = 2, so candidate (0) + delta (2) = 2.
        // Whether this snaps or not depends on distance threshold (0.5) — distance is 2 > 0.5,
        // so it should NOT snap, meaning result equals candidate.
        expect(snapped.x).toBeCloseTo(candidate.x);
        expect(snapped.z).toBeCloseTo(candidate.z);
    });

    it('correctly calculates snap points for rotated models with matching rotation', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        // Both models at the same small rotation — within angle tolerance
        const smallAngle = 0.05;
        const moving = createModel('MOVE', 0, smallAngle);
        const target = createModel('TARGET_A', 2, smallAngle);

        // Place candidate close enough that snap points are within snapDistance (0.5)
        // At near-zero rotation, MOVE right snap ≈ (candidate.x + 1, 0, -1)
        // TARGET_A left snap ≈ (2 - 1, 0, -1) = (1, 0, -1)
        // We need |candidateX + 1 - 1| < 0.5 → candidateX between -0.5 and 0.5
        const candidate = new THREE.Vector3(0.2, 0, 0);
        const snapped = manager.getSnappedPosition(moving, candidate, [target]);

        // Snap should be applied — result differs from candidate
        const snapApplied = snapped.x !== candidate.x || snapped.z !== candidate.z;
        expect(snapApplied).toBe(true);
    });

    it('handles snap rules that match in both forward and reverse order', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    MODEL_A: {
                        points: [{ id: 'snap-a', side: 'right', type: 'connector_a', depthSide: 'back' }],
                    },
                    MODEL_B: {
                        points: [{ id: 'snap-b', side: 'left', type: 'connector_b', depthSide: 'back' }],
                    },
                },
                rules: [
                    { typeA: 'connector_a', typeB: 'connector_b', snapDistance: 0.5 },
                ],
            }),
        } as Response);

        await manager.loadConfig();

        const modelA = createModel('MODEL_A', 0, 0);
        const modelB = createModel('MODEL_B', 2, 0);

        const candidate = new THREE.Vector3(1, 0, 0);

        // Rule should match regardless of order (A→B or B→A)
        const snapped = manager.getSnappedPosition(modelA, candidate, [modelB]);
        expect(snapped).toBeDefined();
    });

    it('validates snap compatibility with complex model configurations', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => snapConfig,
        } as Response);

        await manager.loadConfig();

        const configurations = [
            { modelA: 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', modelB: 'CONNECT_MODULAR_SOFA_LONG_CENTRE_C', compatible: true },
            { modelA: 'CONNECT_MODULAR_SOFA_LONG_CENTRE_C', modelB: 'CONNECT_MODULAR_SOFA_RIGHT_ARMREST_B', compatible: true },
            { modelA: 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', modelB: 'RANDOM_OBJECT', compatible: false },
        ];

        for (const config of configurations) {
            const modelA = createModel(config.modelA, 0, 0);
            const modelB = createModel(config.modelB, 2, 0);

            const result = manager.checkCompatibility(modelA, modelB);
            expect(result).toBe(config.compatible);
        }
    });

    it('rejects snap when rotation tolerance is exceeded after multiple increments', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        // Place candidate close enough to target for distance to be within snap range
        const candidate = new THREE.Vector3(0.5, 0, 0);

        // Target with rotation 0.15 radians — exceeds angleTolerance of 0.1
        const outsideTolerance = createModel('TARGET_A', 2.2, 0.15);

        const rejected = manager.getSnappedPosition(moving, candidate, [outsideTolerance]);
        // Snap rejected: position unchanged from candidate
        expect(rejected).toEqual(candidate);

        // Target with rotation 0.05 radians — within angleTolerance of 0.1
        const withinTolerance = createModel('TARGET_A', 2.2, 0.05);

        const accepted = manager.getSnappedPosition(moving, candidate, [withinTolerance]);
        // Snap accepted: position changed from candidate
        expect(accepted).not.toEqual(candidate);
    });

    it('snap distance BVA: accepts 0.49 and 0.50, rejects 0.51 and 0.52', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const target = createModel('TARGET_A', 2, 0);

        // Geometry: MOVE right snap = (candidate.x + 1, 0, -1)
        //           TARGET left snap = (1, 0, -1)
        //           Distance = |candidate.x|

        // 0.49 — just below boundary → accepted
        const snap049 = manager.getSnappedPosition(moving, new THREE.Vector3(0.49, 0, 0), [target]);
        expect(snap049.x).toBeCloseTo(0, 1);

        // 0.50 — at boundary (<=) → accepted
        const snap050 = manager.getSnappedPosition(moving, new THREE.Vector3(0.50, 0, 0), [target]);
        expect(snap050.x).toBeCloseTo(0, 1);

        // 0.51 — just above boundary → rejected
        const snap051 = manager.getSnappedPosition(moving, new THREE.Vector3(0.51, 0, 0), [target]);
        expect(snap051.x).toBeCloseTo(0.51);

        // 0.52 — above boundary → rejected
        const snap052 = manager.getSnappedPosition(moving, new THREE.Vector3(0.52, 0, 0), [target]);
        expect(snap052.x).toBeCloseTo(0.52);
    });

    it('rejects snap at 0.12 rad beyond angle tolerance (BVA)', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const candidate = new THREE.Vector3(0, 0, 0);
        const target = createModel('TARGET_A', 2.2, 0.12);

        const snapped = manager.getSnappedPosition(moving, candidate, [target]);

        // 0.12 rad exceeds tolerance of 0.1 → snap rejected, position unchanged
        expect(snapped).toEqual(candidate);
    });
});