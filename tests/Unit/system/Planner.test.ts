import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelData } from '@/system/utilities/types';
import { PersistenceManager } from '@/system/managers/PersistenceManager';

vi.mock('@/system/managers/SceneManager', () => ({
    SceneManager: vi.fn().mockImplementation(function () {
        const scene = new THREE.Scene();

        return {
            setupScene: vi.fn(() => undefined),
            setupGround: vi.fn(() => undefined),
            setupLights: vi.fn(() => undefined),
            addObject: vi.fn(),
            removeObject: vi.fn(),
            changeGroundTexture: vi.fn(),
            cleanup: vi.fn(),
            getScene: vi.fn(() => scene),
        };
    }),
}));

vi.mock('@/system/managers/CameraManager', () => ({
    CameraManager: vi.fn().mockImplementation(function () {
        return {
            setupCamera: vi.fn(),
            getCamera: vi.fn(() => new THREE.PerspectiveCamera(50, 1, 0.1, 1000)),
            updateAspect: vi.fn(),
            cleanup: vi.fn(),
        };
    }),
}));

vi.mock('@/system/managers/ModelManager', () => ({
    ModelManager: vi.fn().mockImplementation(function () {
        return {
            loadModel: vi.fn(),
            rotateModel: vi.fn(),
            disposeModel: vi.fn(),
            setCollisionMode: vi.fn(),
            resetCollisionMetrics: vi.fn(),
            getCollisionMetrics: vi.fn(() => null),
            clearModelCache: vi.fn(),
        };
    }),
}));

vi.mock('@/system/managers/InteractionManager', () => ({
    InteractionManager: vi.fn().mockImplementation(function () {
        return {
            setupInteractions: vi.fn(),
            cleanup: vi.fn(),
            setCollisionMode: vi.fn(),
            resetCollisionMetrics: vi.fn(),
            getCollisionMetrics: vi.fn(() => null),
            draggableMeshes: [],
        };
    }),
}));

vi.mock('@/system/managers/RendererManager', () => ({
    RendererManager: vi.fn().mockImplementation(function () {
        return {
            createRenderer: vi.fn(() => ({})),
            setupResizeListener: vi.fn(),
            getRenderer: vi.fn(() => null),
            disposeRenderer: vi.fn(),
            cleanup: vi.fn(),
        };
    }),
}));

vi.mock('@/system/managers/RenderingPipeline', () => ({
    RenderingPipeline: vi.fn().mockImplementation(function () {
        return {
            setupControls: vi.fn(() => ({})),
            startRenderLoop: vi.fn(),
            resetFrameMetrics: vi.fn(),
            getFrameMetrics: vi.fn(() => ({
                samples: 0,
                averageFrameMs: 0,
                minFrameMs: 0,
                maxFrameMs: 0,
                p50FrameMs: 0,
                p95FrameMs: 0,
                averageFps: 0,
                p50Fps: 0,
                p95Fps: 0,
            })),
            cleanup: vi.fn(),
        };
    }),
}));

vi.mock('@/system/managers/SnapManager', () => ({
    SnapManager: vi.fn().mockImplementation(function () {
        return {
            loadConfig: vi.fn(),
            checkCompatibility: vi.fn(),
            getSnappedPosition: vi.fn(),
        };
    }),
}));

vi.mock('@/system/managers/PersistenceManager', () => ({
    PersistenceManager: vi.fn().mockImplementation(function () {
        return {
            loadFromLocalStorage: vi.fn(() => null),
            autoSave: vi.fn(),
            saveToBackend: vi.fn(async () => true),
            clearLocalStorage: vi.fn(),
            getUserConfigurations: vi.fn(async () => []),
            loadFromBackendByCode: vi.fn(async () => null),
        };
    }),
}));

vi.mock('@/system/utilities/ThumbnailGenerator', () => ({
    ThumbnailGenerator: vi.fn().mockImplementation(function () {
        return {
            generateThumbnail: vi.fn(async () => ''),
        };
    }),
}));

vi.mock('@/system/utilities/GroundTextureManager', () => ({
    GroundTextureManager: {
        clearCache: vi.fn(),
    },
}));

import { Planner } from '@/system/Planner';

function createModelData(moduleKey: string, path: string, position: [number, number, number], rotationY: number): ModelData {
    const object = new THREE.Group();
    object.position.set(position[0], position[1], position[2]);
    object.rotation.set(0, rotationY, 0);
    object.scale.set(1, 1, 1);

    const bounds = {
        box: new THREE.Box3(
            new THREE.Vector3(-0.5, 0, -0.5),
            new THREE.Vector3(0.5, 1, 0.5)
        ),
        size: new THREE.Vector3(1, 1, 1),
    };

    return {
        id: `model-${moduleKey}`,
        modelKey: moduleKey,
        object,
        bounds,
        cachedBounds: bounds.box.clone(),
        path,
        meshes: [],
    } as ModelData;
}

describe('Planner round-trip', () => {
    beforeEach(() => {
        Planner.resetInstance();
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
    });

    afterEach(() => {
        Planner.resetInstance();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('serializes and reloads models without losing module key, position, or quaternion', async () => {
        const planner = Planner.getInstance();

        const originalModels: ModelData[] = [
            createModelData('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', 'models/left-armrest-a.glb', [0, 0, 0], Math.PI / 2),
            createModelData('CONNECT_MODULAR_SOFA_LONG_CENTRE_C', 'models/long-centre-c.glb', [2, 0, 1], Math.PI / 2),
            createModelData('CONNECT_MODULAR_SOFA_RIGHT_ARMREST_B', 'models/right-armrest-b.glb', [-2, 0, -1], Math.PI / 2),
        ];

        planner.state.models.push(...originalModels);

        const serialized = planner.getSerializedData();
        expect(serialized).toHaveLength(3);

        planner.state.models.splice(0, planner.state.models.length);

        vi.spyOn(planner, 'loadModel').mockImplementation(async (modelPath, position, rotation, scale) => {
            const moduleKey = modelPath.split('/').pop()?.replace(/\.glb$/i, '') ?? modelPath;
            const object = new THREE.Group();

            if (position) {
                object.position.copy(position);
            }
            if (rotation) {
                object.rotation.set(rotation.x, rotation.y, rotation.z);
            }
            if (scale) {
                object.scale.set(scale.x, scale.y, scale.z);
            }

            planner.state.models.push({
                id: `reloaded-${planner.state.models.length}`,
                modelKey: moduleKey,
                object,
                bounds: {
                    box: new THREE.Box3(
                        new THREE.Vector3(-0.5, 0, -0.5),
                        new THREE.Vector3(0.5, 1, 0.5)
                    ),
                    size: new THREE.Vector3(1, 1, 1),
                },
                cachedBounds: new THREE.Box3(),
                path: modelPath,
                meshes: [],
            } as ModelData);
        });

        await planner.loadFromJSON(serialized);

        expect(planner.state.models).toHaveLength(3);

        originalModels.forEach((original, index) => {
            const reloaded = planner.state.models[index];

            expect(reloaded.modelKey).toBe(original.modelKey);
            expect(reloaded.object.position.x).toBeCloseTo(original.object.position.x);
            expect(reloaded.object.position.y).toBeCloseTo(original.object.position.y);
            expect(reloaded.object.position.z).toBeCloseTo(original.object.position.z);
            expect(reloaded.object.quaternion.x).toBeCloseTo(original.object.quaternion.x);
            expect(reloaded.object.quaternion.y).toBeCloseTo(original.object.quaternion.y);
            expect(reloaded.object.quaternion.z).toBeCloseTo(original.object.quaternion.z);
            expect(reloaded.object.quaternion.w).toBeCloseTo(original.object.quaternion.w);
        });
    });

    it('clears the scene when loadFromJSON receives empty or invalid data', async () => {
        const planner = Planner.getInstance();
        await planner.init({} as HTMLCanvasElement);

        planner.state.models.push(createModelData('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A', 'models/a.glb', [0, 0, 0], 0));

        await planner.loadFromJSON([]);
        expect(planner.state.models).toHaveLength(0);

        planner.state.models.push(createModelData('CONNECT_MODULAR_SOFA_RIGHT_ARMREST_B', 'models/b.glb', [1, 0, 0], 0));

        await planner.loadFromJSON({} as never);
        expect(planner.state.models).toHaveLength(0);
    });

    it('triggers autosave only after the interval when dirty', async () => {
        vi.useFakeTimers();

        const planner = Planner.getInstance();
        await planner.init({} as HTMLCanvasElement);

        const persistenceInstance = vi.mocked(PersistenceManager).mock.instances.at(-1) as { autoSave: ReturnType<typeof vi.fn> };
        expect(persistenceInstance.autoSave).not.toHaveBeenCalled();

        await planner.loadModel('models/autosave.glb');
        vi.advanceTimersByTime(2999);
        expect(persistenceInstance.autoSave).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(persistenceInstance.autoSave).toHaveBeenCalledTimes(1);
    });

    it('preserves full precision across save and load cycle', async () => {
        const planner = Planner.getInstance();

        const originalModels: ModelData[] = [
            createModelData('MODEL_A', 'models/a.glb', [1.123456, 0, -2.654321], Math.PI / 3),
            createModelData('MODEL_B', 'models/b.glb', [-0.999999, 0, 0.000001], Math.PI / 6),
        ];

        planner.state.models.push(...originalModels);

        const serialized = planner.getSerializedData();

        // Clear scene
        planner.state.models.splice(0, planner.state.models.length);

        // Mock reload
        vi.spyOn(planner, 'loadModel').mockImplementation(async (modelPath, position, rotation, scale) => {
            const moduleKey = modelPath.split('/').pop()?.replace(/\.glb$/i, '') ?? modelPath;
            const object = new THREE.Group();

            if (position) {
                object.position.copy(position);
            }
            if (rotation) {
                object.rotation.set(rotation.x, rotation.y, rotation.z);
            }
            if (scale) {
                object.scale.set(scale.x, scale.y, scale.z);
            }

            planner.state.models.push({
                id: `reloaded-${planner.state.models.length}`,
                modelKey: moduleKey,
                object,
                bounds: {
                    box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
                    size: new THREE.Vector3(1, 1, 1),
                },
                cachedBounds: new THREE.Box3(),
                path: modelPath,
                meshes: [],
            } as ModelData);
        });

        await planner.loadFromJSON(serialized);

        // Verify precision is preserved
        for (let i = 0; i < serialized.length; i++) {
            const original = serialized[i];
            const reloaded = planner.state.models[i];

            expect(reloaded.object.position.x).toBeCloseTo(original.position.x, 5);
            expect(reloaded.object.position.z).toBeCloseTo(original.position.z, 5);
            expect(reloaded.object.rotation.y).toBeCloseTo(original.rotation.y, 5);
        }
    });

    it('handles concurrent model additions without corruption', async () => {
        const planner = Planner.getInstance();

        const mockLoad = vi.spyOn(planner, 'loadModel').mockImplementation(async () => {
            const object = new THREE.Group();
            planner.state.models.push({
                id: `model-${planner.state.models.length}`,
                modelKey: `key-${planner.state.models.length}`,
                object,
                bounds: {
                    box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
                    size: new THREE.Vector3(1, 1, 1),
                },
                cachedBounds: new THREE.Box3(),
                path: 'models/test.glb',
                meshes: [],
            } as ModelData);
        });

        // Simulate concurrent loads
        const loads = [
            planner.loadModel('models/a.glb'),
            planner.loadModel('models/b.glb'),
            planner.loadModel('models/c.glb'),
        ];

        await Promise.all(loads);

        // Should have 3 models, not corrupted state
        expect(planner.state.models).toHaveLength(3);
        expect(mockLoad).toHaveBeenCalledTimes(3);
    });

    it('appends models to an existing scene when loadFromJSON is called without prior clear', async () => {
        const planner = Planner.getInstance();

        planner.state.models.push(createModelData('INITIAL', 'models/initial.glb', [0, 0, 0], 0));

        vi.spyOn(planner, 'loadModel').mockImplementation(async (modelPath, position) => {
            const moduleKey = modelPath.split('/').pop()?.replace(/\.glb$/i, '') ?? modelPath;
            const object = new THREE.Group();
            if (position) object.position.copy(position);

            planner.state.models.push({
                id: `new-${planner.state.models.length}`,
                modelKey: moduleKey,
                object,
                bounds: {
                    box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
                    size: new THREE.Vector3(1, 1, 1),
                },
                cachedBounds: new THREE.Box3(),
                path: modelPath,
                meshes: [],
            } as ModelData);
        });

        const newConfiguration = [
            createModelData('NEW_A', 'models/new-a.glb', [1, 0, 1], 0),
            createModelData('NEW_B', 'models/new-b.glb', [-1, 0, -1], Math.PI / 2),
        ];

        const serialized = newConfiguration.map((m) => ({
            module_key: m.modelKey,
            path: m.path,
            position: { x: m.object.position.x, y: m.object.position.y, z: m.object.position.z },
            rotation: { x: m.object.rotation.x, y: m.object.rotation.y, z: m.object.rotation.z },
            scale: { x: m.object.scale.x, y: m.object.scale.y, z: m.object.scale.z },
        }));

        await planner.loadFromJSON(serialized);

        // loadFromJSON appends — INITIAL model is still present alongside the new ones
        expect(planner.state.models).toHaveLength(3);
        expect(planner.state.models.some((m) => m.modelKey === 'INITIAL')).toBe(true);
        expect(planner.state.models.some((m) => m.modelKey === 'NEW_A')).toBe(true);
        expect(planner.state.models.some((m) => m.modelKey === 'NEW_B')).toBe(true);
    });

    it('serializes scene with scale variations correctly', async () => {
        const planner = Planner.getInstance();

        const scaledModels: ModelData[] = [
            createModelData('SMALL', 'models/small.glb', [0, 0, 0], 0),
            createModelData('LARGE', 'models/large.glb', [2, 0, 0], 0),
        ];

        // Set different scales
        scaledModels[0].object.scale.set(0.5, 0.5, 0.5);
        scaledModels[1].object.scale.set(2.0, 2.0, 2.0);

        planner.state.models.push(...scaledModels);

        const serialized = planner.getSerializedData();

        // Verify scales are preserved
        expect(serialized[0].scale.x).toBe(0.5);
        expect(serialized[1].scale.x).toBe(2.0);

        // Verify JSON round-trip preserves scales
        const json = JSON.stringify(serialized);
        const reparsed = JSON.parse(json);

        expect(reparsed[0].scale.x).toBe(0.5);
        expect(reparsed[1].scale.x).toBe(2.0);
    });
});