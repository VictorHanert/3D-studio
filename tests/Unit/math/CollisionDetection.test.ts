import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

function boxesOverlap(firstBox: THREE.Box3, secondBox: THREE.Box3): boolean {
    return firstBox.intersectsBox(secondBox);
}

describe('boxesOverlap', () => {
    it('returns true when two axis-aligned boxes overlap', () => {
        const firstBox = new THREE.Box3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(2, 2, 2),
        );
        const secondBox = new THREE.Box3(
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(3, 3, 3),
        );

        expect(boxesOverlap(firstBox, secondBox)).toBe(true);
    });

    it('returns false when boxes are separated', () => {
        const firstBox = new THREE.Box3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 1, 1),
        );
        const secondBox = new THREE.Box3(
            new THREE.Vector3(2, 2, 2),
            new THREE.Vector3(3, 3, 3),
        );

        expect(boxesOverlap(firstBox, secondBox)).toBe(false);
    });
});
