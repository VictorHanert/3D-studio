import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelData } from '@/system/utilities/types';

const gltfLoaderMock = vi.hoisted(() => ({
    loadAsync: vi.fn(),
}));

vi.mock('three-stdlib', () => ({
    GLTFLoader: vi.fn().mockImplementation(function () {
        return gltfLoaderMock;
    }),
}));

import { SceneManager } from '@/system/managers/SceneManager';
import { ModelManager } from '@/system/managers/ModelManager';

function createLoadedScene(): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    group.add(mesh);
    return group;
}

describe('ModelManager cache and failure handling', () => {
    let sceneManager: SceneManager;
    let models: { value: ModelData[] };
    let draggableMeshes: THREE.Mesh[];

    beforeEach(() => {
        sceneManager = new SceneManager();
        sceneManager.scene = new THREE.Scene();
        models = { value: [] };
        draggableMeshes = [];
        gltfLoaderMock.loadAsync.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('deduplicates concurrent requests for the same model URL', async () => {
        let resolveLoad: ((value: { scene: THREE.Group }) => void) | null = null;

        gltfLoaderMock.loadAsync.mockImplementationOnce(() => {
            return new Promise<{ scene: THREE.Group }>((resolve) => {
                resolveLoad = resolve;
            });
        });

        const manager = new ModelManager(sceneManager, models as never, draggableMeshes);

        const firstLoad = manager.loadModel('/models/sofa.glb', new THREE.Vector3(0, 0, 0));
        const secondLoad = manager.loadModel('/models/sofa.glb', new THREE.Vector3(2, 0, 0));

        expect(gltfLoaderMock.loadAsync).toHaveBeenCalledTimes(1);

        resolveLoad?.({ scene: createLoadedScene() });

        await Promise.all([firstLoad, secondLoad]);

        expect(models.value).toHaveLength(2);
        expect(gltfLoaderMock.loadAsync).toHaveBeenCalledTimes(1);
    });

    it('handles a failed model load without crashing', async () => {
        gltfLoaderMock.loadAsync.mockRejectedValueOnce(new Error('404 not found'));

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const manager = new ModelManager(sceneManager, models as never, draggableMeshes);

        await expect(manager.loadModel('/models/missing.glb', new THREE.Vector3(0, 0, 0))).resolves.toBeUndefined();

        expect(models.value).toHaveLength(0);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('retries loading after a failed asset request for the same path', async () => {
        gltfLoaderMock.loadAsync
            .mockRejectedValueOnce(new Error('404 not found'))
            .mockResolvedValueOnce({ scene: createLoadedScene() });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const manager = new ModelManager(sceneManager, models as never, draggableMeshes);

        await manager.loadModel('/models/missing-then-fixed.glb', new THREE.Vector3(0, 0, 0));
        await manager.loadModel('/models/missing-then-fixed.glb', new THREE.Vector3(1, 0, 0));

        expect(gltfLoaderMock.loadAsync).toHaveBeenCalledTimes(2);
        expect(models.value).toHaveLength(1);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores invalid model paths before loader execution', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const manager = new ModelManager(sceneManager, models as never, draggableMeshes);

        await manager.loadModel('' as unknown as string, new THREE.Vector3(0, 0, 0));

        expect(gltfLoaderMock.loadAsync).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid model path:', '');
        expect(models.value).toHaveLength(0);
    });

    it('handles disposing the same model twice without throwing', () => {
        const manager = new ModelManager(sceneManager, models as never, draggableMeshes);
        const removeObjectSpy = vi.spyOn(sceneManager, 'removeObject');

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const firstMaterial = new THREE.MeshBasicMaterial();
        const secondMaterial = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, [firstMaterial, secondMaterial]);
        const object = new THREE.Group();
        object.add(mesh);
        sceneManager.scene.add(object);

        draggableMeshes.push(mesh);

        const model: ModelData = {
            id: 'double-dispose',
            modelKey: 'double-dispose',
            object,
            bounds: {
                box: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
                size: new THREE.Vector3(1, 1, 1),
            },
            cachedBounds: new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)),
            path: '/models/double-dispose.glb',
            meshes: [mesh],
        } as ModelData;

        expect(() => manager.disposeModel(model)).not.toThrow();
        expect(draggableMeshes).toHaveLength(0);

        expect(() => manager.disposeModel(model)).not.toThrow();
        expect(removeObjectSpy).toHaveBeenCalledTimes(1);
    });

    it('calculates bounds correctly for model with multiple child meshes', () => {
        // This test validates that bounds calculation accounts for all mesh positions
        const group = new THREE.Group();
        group.position.set(5, 0, 0); // Position model in space

        // Create mesh at y=0 (extends -0.5 to 0.5)
        const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        mesh1.position.set(0, 0, 0);
        group.add(mesh1);

        // Create mesh at y=-2 (extends -2.5 to -1.5)
        const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        mesh2.position.set(0, -2, 0);
        group.add(mesh2);

        // Bounds should encompass all children: y from -2.5 to 0.5 (range of 3.0)
        const bounds = new THREE.Box3().setFromObject(group);

        expect(bounds.min.y).toBeCloseTo(-2.5, 1);
        expect(bounds.max.y).toBeCloseTo(0.5, 1);
        expect(bounds.getSize(new THREE.Vector3()).y).toBeCloseTo(3.0, 1);
    });
});