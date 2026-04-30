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
});