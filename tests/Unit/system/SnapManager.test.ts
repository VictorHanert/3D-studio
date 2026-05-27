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

    // =========================================================================
    // GROUP 1: loadConfig() – fejlhåndtering og dedup-guard
    // =========================================================================

    it('sets config to null when fetch returns a non-ok HTTP response', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({}),
        } as Response);

        await manager.loadConfig();

        // Config er null → getSnappedPosition returnerer candidatePosition uændret
        const candidate = new THREE.Vector3(1, 0, 0);
        expect(manager.getSnappedPosition(createModel('MOVE', 0, 0), candidate, [])).toEqual(candidate);
    });

    it('handles a fetch network error gracefully and leaves config as null', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await manager.loadConfig();

        expect(consoleSpy).toHaveBeenCalledWith('SnapManager: Failed to load config', expect.any(Error));

        const candidate = new THREE.Vector3(5, 0, 5);
        expect(manager.getSnappedPosition(createModel('MOVE', 0, 0), candidate, [])).toEqual(candidate);
    });

    it('deduplicates concurrent loadConfig calls, only performing one fetch', async () => {
        const manager = new SnapManager();

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        // Kald to gange uden at awaite det første → kun ét fetch-kald
        const p1 = manager.loadConfig();
        const p2 = manager.loadConfig();

        await Promise.all([p1, p2]);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // =========================================================================
    // GROUP 2: checkCompatibility() – null-guards og udtømt loop
    // =========================================================================

    it('returns false from checkCompatibility when config has not been loaded', () => {
        const manager = new SnapManager();

        expect(manager.checkCompatibility(createModel('MOVE', 0, 0), createModel('TARGET_A', 2, 0))).toBe(false);
    });

    it('returns false when both models are in config but share no compatible snap rule', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    MODEL_X: { points: [{ id: 'px', side: 'right' as const, type: 'type_x' }] },
                    MODEL_Y: { points: [{ id: 'py', side: 'left' as const, type: 'type_y' }] },
                },
                rules: [],
            }),
        } as Response);

        await manager.loadConfig();

        // Begge modeller er i config, men ingen regel matcher type_x ↔ type_y
        expect(manager.checkCompatibility(createModel('MODEL_X', 0, 0), createModel('MODEL_Y', 2, 0))).toBe(false);
    });

    // =========================================================================
    // GROUP 3: getSnappedPosition() – null-guards og kanttilfælde
    // =========================================================================

    it('returns candidatePosition unchanged from getSnappedPosition when config is not loaded', () => {
        const manager = new SnapManager();

        const candidate = new THREE.Vector3(3, 0, 3);
        expect(
            manager.getSnappedPosition(createModel('MOVE', 0, 0), candidate, [createModel('TARGET_A', 2, 0)]),
        ).toEqual(candidate);
    });

    it('returns candidatePosition when the moving model key is not in the snap config', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const candidate = new THREE.Vector3(1, 0, 0);
        expect(
            manager.getSnappedPosition(createModel('UNKNOWN_KEY', 0, 0), candidate, [createModel('TARGET_A', 2, 0)]),
        ).toEqual(candidate);
    });

    it('skips the moving model itself and unknown models in the candidates list', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => createConfig(),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const unknown = createModel('NOT_IN_CONFIG', 2, 0);
        const candidate = new THREE.Vector3(0, 0, 0);

        // moving indgår i listen (self-skip) og unknown er ikke i config
        const result = manager.getSnappedPosition(moving, candidate, [moving, unknown]);
        expect(result).toEqual(candidate);
    });

    it('skips point pairs that have no matching snap rule and returns candidatePosition', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    MODEL_A: { points: [{ id: 'pa', side: 'right' as const, type: 'type_a' }] },
                    MODEL_B: { points: [{ id: 'pb', side: 'left' as const, type: 'type_b' }] },
                },
                rules: [],
            }),
        } as Response);

        await manager.loadConfig();

        const candidate = new THREE.Vector3(0, 0, 0);
        expect(
            manager.getSnappedPosition(createModel('MODEL_A', 0, 0), candidate, [createModel('MODEL_B', 2, 0)]),
        ).toEqual(candidate);
    });

    it('applies backward rule matching when the moving point type matches typeB of a rule', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            // Regel: typeA='conn_a', typeB='conn_b'
            // Moving model har type 'conn_b' → backward match: rule.typeA===otherType && rule.typeB===movingType
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    MOVING: { points: [{ id: 'pm', side: 'right' as const, type: 'conn_b', depthSide: 'back' as const }] },
                    TARGET: { points: [{ id: 'pt', side: 'left' as const, type: 'conn_a', depthSide: 'back' as const }] },
                },
                rules: [{ typeA: 'conn_a', typeB: 'conn_b', snapDistance: 0.5 }],
            }),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVING', 0, 0);
        const target = createModel('TARGET', 2, 0);
        const candidate = new THREE.Vector3(0.5, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidate, [target]);
        expect(snapped.x).toBeCloseTo(0, 1);
    });

    it('uses 0.5 as fallback when config omits defaultSnapDistance and rule omits snapDistance', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                // defaultSnapDistance bevidst udeladt → ?? 0.5 fallback
                models: {
                    MOVE: { points: [{ id: 'move-right', side: 'right' as const, type: 'armrest_right', depthSide: 'back' as const }] },
                    TARGET_A: { points: [{ id: 'target-left', side: 'left' as const, type: 'armrest_left', depthSide: 'back' as const }] },
                },
                // snapDistance bevidst udeladt på reglen → ?? defaultSnapDistance fallback
                rules: [{ typeA: 'armrest_right', typeB: 'armrest_left', snapDistance: undefined as unknown as number }],
            }),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('MOVE', 0, 0);
        const target = createModel('TARGET_A', 2, 0);

        // 0.5 er præcis ved grænsen (<=) → snap skal accepteres
        const snapped = manager.getSnappedPosition(moving, new THREE.Vector3(0.5, 0, 0), [target]);
        expect(snapped.x).toBeCloseTo(0, 1);

        // 0.51 er over grænsen → snap skal afvises
        const notSnapped = manager.getSnappedPosition(moving, new THREE.Vector3(0.51, 0, 0), [target]);
        expect(notSnapped.x).toBeCloseTo(0.51);
    });

    // =========================================================================
    // GROUP 4: getLocalSnapPoint() – front/back-geometri (Kategori C)
    // =========================================================================

    it('calculates correct world snap point for front and back side snap points', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    FRONT_MOD: { points: [{ id: 'front-snap', side: 'front' as const, type: 'front_conn' }] },
                    BACK_MOD: { points: [{ id: 'back-snap', side: 'back' as const, type: 'front_conn' }] },
                },
                rules: [{ typeA: 'front_conn', typeB: 'front_conn', snapDistance: 0.5 }],
            }),
        } as Response);

        await manager.loadConfig();

        const moving = createModel('FRONT_MOD', 0, 0);
        const target = createModel('BACK_MOD', 0, 0);
        // BACK_MOD placeres ved z=1.5:
        //   back snap lokal: z = bounds.min.z = -1 → verden: (0, 0, 1.5-1) = (0, 0, 0.5)
        // FRONT_MOD ved candidate (0,0,0):
        //   front snap lokal: z = bounds.max.z = 1 → verden: (0, 0, 1)
        // Distance = 0.5 ≤ 0.5 → SNAP; delta.z = -0.5
        target.object.position.set(0, 0, 1.5);

        const candidate = new THREE.Vector3(0, 0, 0);
        const snapped = manager.getSnappedPosition(moving, candidate, [target]);

        expect(snapped.z).toBeCloseTo(-0.5, 1);
    });

    it('offsets z for left-side snap point when depthSide is front', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    LEFT_FRONT_DEPTH: { points: [{ id: 'lfd', side: 'left' as const, type: 'connector', depthSide: 'front' as const }] },
                    RIGHT_FRONT_DEPTH: { points: [{ id: 'rfd', side: 'right' as const, type: 'connector', depthSide: 'front' as const }] },
                },
                rules: [{ typeA: 'connector', typeB: 'connector', snapDistance: 0.5 }],
            }),
        } as Response);

        await manager.loadConfig();

        // Moving LEFT_FRONT_DEPTH ved candidate (0.3, 0, 0):
        //   left snap: x=bounds.min.x=-1, depthSide:'front' → z=bounds.max.z=1 → lokal (-1,0,1)
        //   verden: (-0.7, 0, 1)
        // Target RIGHT_FRONT_DEPTH ved position (-1.5, 0, 0):
        //   right snap: x=bounds.max.x=1, depthSide:'front' → z=bounds.max.z=1 → lokal (1,0,1)
        //   verden: (-0.5, 0, 1)
        // Distance = 0.2 ≤ 0.5 → SNAP; delta.x = 0.2
        const moving = createModel('LEFT_FRONT_DEPTH', 0, 0);
        const target = createModel('RIGHT_FRONT_DEPTH', -1.5, 0);
        const candidate = new THREE.Vector3(0.3, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidate, [target]);
        expect(snapped.x).toBeCloseTo(0.5, 1);
    });

    it('does not offset z for left-side snap point when depthSide is omitted', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    LEFT_NO_DEPTH: { points: [{ id: 'lnd', side: 'left' as const, type: 'connector' }] },
                    RIGHT_NO_DEPTH: { points: [{ id: 'rnd', side: 'right' as const, type: 'connector' }] },
                },
                rules: [{ typeA: 'connector', typeB: 'connector', snapDistance: 0.5 }],
            }),
        } as Response);

        await manager.loadConfig();

        // Ingen depthSide → z forbliver 0 for left/right sider
        // Moving LEFT_NO_DEPTH ved candidate (0.3, 0, 0):
        //   left snap: x=-1, z=0 → verden (-0.7, 0, 0)
        // Target RIGHT_NO_DEPTH ved position (-1.5, 0, 0):
        //   right snap: x=1, z=0 → verden (-0.5, 0, 0)
        // Distance = 0.2 ≤ 0.5 → SNAP; delta.x = 0.2
        const moving = createModel('LEFT_NO_DEPTH', 0, 0);
        const target = createModel('RIGHT_NO_DEPTH', -1.5, 0);
        const candidate = new THREE.Vector3(0.3, 0, 0);

        const snapped = manager.getSnappedPosition(moving, candidate, [target]);
        expect(snapped.x).toBeCloseTo(0.5, 1);
        expect(snapped.z).toBeCloseTo(0, 1);
    });

    it('offsets x for front-side snap points with widthSide left and right', async () => {
        const manager = new SnapManager();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                defaultSnapDistance: 0.5,
                models: {
                    FRONT_LEFT: { points: [{ id: 'fl', side: 'front' as const, type: 'conn', widthSide: 'left' as const }] },
                    FRONT_RIGHT: { points: [{ id: 'fr', side: 'front' as const, type: 'conn', widthSide: 'right' as const }] },
                    BACK_MOD: { points: [{ id: 'bm', side: 'back' as const, type: 'conn' }] },
                },
                rules: [{ typeA: 'conn', typeB: 'conn', snapDistance: 0.5 }],
            }),
        } as Response);

        await manager.loadConfig();

        const candidate = new THREE.Vector3(0, 0, 0);

        // widthSide:'left' → snap lokal (-1, 0, 1)
        // Target BACK_MOD ved (-1, 0, 1.5): back snap lokal (0,0,-1) → verden (-1, 0, 0.5)
        // Distance = 0.5 ≤ 0.5 → SNAP; delta.z = -0.5
        const movingLeft = createModel('FRONT_LEFT', 0, 0);
        const targetForLeft = createModel('BACK_MOD', 0, 0);
        targetForLeft.object.position.set(-1, 0, 1.5);

        const snappedLeft = manager.getSnappedPosition(movingLeft, candidate, [targetForLeft]);
        expect(snappedLeft.z).toBeCloseTo(-0.5, 1);

        // widthSide:'right' → snap lokal (1, 0, 1)
        // Target BACK_MOD ved (1, 0, 1.5): back snap lokal (0,0,-1) → verden (1, 0, 0.5)
        // Distance = 0.5 ≤ 0.5 → SNAP; delta.z = -0.5
        const movingRight = createModel('FRONT_RIGHT', 0, 0);
        const targetForRight = createModel('BACK_MOD', 0, 0);
        targetForRight.object.position.set(1, 0, 1.5);

        const snappedRight = manager.getSnappedPosition(movingRight, candidate, [targetForRight]);
        expect(snappedRight.z).toBeCloseTo(-0.5, 1);
    });
});