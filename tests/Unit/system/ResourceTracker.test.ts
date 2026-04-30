import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from '@/system/utilities/ResourceTracker';

describe('ResourceTracker', () => {
    it('disposes geometries and materials when disposing a tracked node', () => {
        const tracker = new ResourceTracker();
        const scene = new THREE.Scene();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial();
        const mesh = new THREE.Mesh(geometry, material);

        scene.add(mesh);

        const geometryDisposeSpy = vi.spyOn(geometry, 'dispose');
        const materialDisposeSpy = vi.spyOn(material, 'dispose');

        tracker.track(mesh);

        expect(tracker.hasResources()).toBe(true);
        expect(tracker.getResourceCount()).toBeGreaterThan(0);

        tracker.disposeNode(mesh);

        expect(geometryDisposeSpy).toHaveBeenCalledTimes(1);
        expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
        expect(mesh.parent).toBeNull();
        expect(tracker.hasResources()).toBe(false);
        expect(tracker.getResourceCount()).toBe(0);
    });
});