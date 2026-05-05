import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from '@/system/utilities/ResourceTracker';

const threeHarness = vi.hoisted(() => ({
    rendererInstances: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
    pmremInstances: [] as Array<{ compileEquirectangularShader: ReturnType<typeof vi.fn>; fromScene: ReturnType<typeof vi.fn> }>,
    groundTexture: {
        getMaterial: vi.fn(),
        clearCache: vi.fn(),
    },
}));

vi.mock('three', async (importOriginal) => {
    const actual = await importOriginal<typeof import('three')>();

    class WebGLRendererMock {
        public readonly domElement = { clientWidth: 1, clientHeight: 1 };
        public readonly shadowMap = { enabled: false, type: 0 };
        public readonly dispose = vi.fn();
        public readonly setPixelRatio = vi.fn();
        public readonly setSize = vi.fn();

        constructor() {
            threeHarness.rendererInstances.push(this);
        }
    }

    class PMREMGeneratorMock {
        public readonly compileEquirectangularShader = vi.fn();
        public readonly fromScene = vi.fn(() => ({ texture: new actual.Texture() }));

        constructor() {
            threeHarness.pmremInstances.push(this);
        }
    }

    return {
        ...actual,
        WebGLRenderer: WebGLRendererMock as unknown as typeof actual.WebGLRenderer,
        PMREMGenerator: PMREMGeneratorMock as unknown as typeof actual.PMREMGenerator,
    };
});

vi.mock('@/system/utilities/GroundTextureManager', () => ({
    GroundTextureManager: threeHarness.groundTexture,
}));

import { SceneManager } from '@/system/managers/SceneManager';

afterEach(() => {
    vi.restoreAllMocks();
    threeHarness.rendererInstances.splice(0, threeHarness.rendererInstances.length);
    threeHarness.pmremInstances.splice(0, threeHarness.pmremInstances.length);
    threeHarness.groundTexture.getMaterial.mockReset();
    threeHarness.groundTexture.clearCache.mockReset();
});

function createMesh(): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

describe('SceneManager lifecycle', () => {
    it('returns early when lifecycle methods are called before setupScene', async () => {
        const manager = new SceneManager();

        expect(() => manager.setupGround()).not.toThrow();
        expect(() => manager.setupLights()).not.toThrow();
        expect(() => manager.removeObject(createMesh())).not.toThrow();
        await expect(manager.changeGroundTexture('pine')).resolves.toBeUndefined();
        expect(() => manager.cleanup()).not.toThrow();
    });

    it('removes objects from the scene and disposes them through the tracker', async () => {
        const manager = new SceneManager();
        const tracker = new ResourceTracker();
        const disposeNodeSpy = vi.spyOn(tracker, 'disposeNode');
        const mesh = createMesh();

        manager.setResourceTracker(tracker);
        manager.setupScene();
        manager.setupGround();
        manager.addObject(mesh);

        expect(manager.getScene()?.children).toContain(mesh);

        manager.removeObject(mesh);

        expect(manager.getScene()?.children).not.toContain(mesh);
        expect(disposeNodeSpy).toHaveBeenCalledWith(mesh);
    });

    it('initializes the full scene lifecycle and disposes resources on cleanup', async () => {
        const manager = new SceneManager();
        threeHarness.groundTexture.getMaterial.mockResolvedValue(new THREE.MeshStandardMaterial());

        manager.setupScene();
        manager.setupGround();
        manager.setupLights();

        expect(threeHarness.rendererInstances).toHaveLength(1);
        expect(threeHarness.pmremInstances).toHaveLength(1);
        expect(threeHarness.rendererInstances[0].dispose).toHaveBeenCalledTimes(1);

        const mesh = createMesh();
        const geometryDisposeSpy = vi.spyOn(mesh.geometry, 'dispose');
        const materialDisposeSpy = vi.spyOn(mesh.material, 'dispose');
        manager.addObject(mesh);

        await manager.changeGroundTexture('pine');

        expect(threeHarness.groundTexture.getMaterial).toHaveBeenCalledWith('pine');
        manager.cleanup();

        expect(geometryDisposeSpy).toHaveBeenCalled();
        expect(materialDisposeSpy).toHaveBeenCalled();
        expect(manager.getScene()?.children).toHaveLength(0);
        expect(threeHarness.groundTexture.clearCache).not.toHaveBeenCalled();
    });
});
