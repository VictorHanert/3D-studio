import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelData } from '@/system/utilities/types';

vi.mock('@/system/managers/SceneManager', () => ({
    SceneManager: vi.fn().mockImplementation(function () {
        return {
        setupScene: vi.fn(),
        setupGround: vi.fn(),
        setupLights: vi.fn(),
        addObject: vi.fn(),
        removeObject: vi.fn(),
        changeGroundTexture: vi.fn(),
        cleanup: vi.fn(),
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
    });

    afterEach(() => {
        Planner.resetInstance();
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
});