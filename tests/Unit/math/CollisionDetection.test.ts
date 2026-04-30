import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
    checkAABBCollision,
    checkOBBCollision,
    createEmptyCollisionMetrics,
    measureCollisionCheck,
    percentile,
    recordCollisionMetric,
    resetCollisionMetrics,
    type CollisionTransform,
} from '@/system/utilities/CollisionDetection';

function createTransform(x: number, y: number, z: number, angleY: number): CollisionTransform {
    return {
        position: new THREE.Vector3(x, y, z),
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY),
        scale: new THREE.Vector3(1, 1, 1),
    };
}

function createWorldAabb(bounds: THREE.Box3, transform: CollisionTransform): THREE.Box3 {
    return bounds.clone().applyMatrix4(new THREE.Matrix4().compose(
        transform.position,
        transform.quaternion,
        transform.scale,
    ));
}

describe('collision detection helpers', () => {
    it('returns true when two axis-aligned boxes overlap', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );

        const firstPosition = new THREE.Vector3(0, 0, 0);
        const secondPosition = new THREE.Vector3(0.5, 0.5, 0.5);

        expect(checkAABBCollision(bounds, firstPosition, bounds, secondPosition)).toBe(true);
    });

    it('returns false when boxes are separated', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );

        expect(checkAABBCollision(
            bounds,
            new THREE.Vector3(0, 0, 0),
            bounds,
            new THREE.Vector3(5, 0, 0),
        )).toBe(false);
    });

    it('returns true for overlapping obb boxes with no rotation', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );

        const firstTransform = createTransform(0, 0, 0, 0);
        const secondTransform = createTransform(0.75, 0, 0, 0);

        expect(checkOBBCollision(bounds, firstTransform, bounds, secondTransform)).toBe(true);
    });

    it('shows the rotated false positive that makes obb necessary', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-3, -0.1, -0.1),
            new THREE.Vector3(3, 0.1, 0.1),
        );

        const firstTransform = createTransform(0, 0, 0, Math.PI / 2);
        const secondTransform = createTransform(0.2000000000000013, -2.7755575615628914e-16, -2.3999999999999986, Math.PI / 2);

        const firstWorldAabb = createWorldAabb(bounds, firstTransform);
        const secondWorldAabb = createWorldAabb(bounds, secondTransform);

        expect(firstWorldAabb.intersectsBox(secondWorldAabb)).toBe(true);
        expect(checkOBBCollision(bounds, firstTransform, bounds, secondTransform)).toBe(false);
    });

    it('measures collision checks in microseconds', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );
        const transform = createTransform(0, 0, 0, 0);

        const measurement = measureCollisionCheck(() => checkOBBCollision(bounds, transform, bounds, transform));

        expect(measurement.result).toBe(true);
        expect(measurement.elapsedMicroseconds).toBeGreaterThanOrEqual(0);
    });

    it('returns true for identical obb transforms', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );
        const transform = createTransform(0, 0, 0, Math.PI / 4);

        expect(checkOBBCollision(bounds, transform, bounds, transform)).toBe(true);
    });

    it('returns true when a smaller obb is nested inside a larger one', () => {
        const outerBounds = new THREE.Box3(
            new THREE.Vector3(-2, -2, -2),
            new THREE.Vector3(2, 2, 2),
        );
        const innerBounds = new THREE.Box3(
            new THREE.Vector3(-0.5, -0.5, -0.5),
            new THREE.Vector3(0.5, 0.5, 0.5),
        );

        const outerTransform = createTransform(0, 0, 0, Math.PI / 6);
        const innerTransform = createTransform(0.25, 0, -0.1, Math.PI / 3);

        expect(checkOBBCollision(outerBounds, outerTransform, innerBounds, innerTransform)).toBe(true);
    });

    it('returns false when obb boxes only touch with a tiny separation', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1, -1, -1),
            new THREE.Vector3(1, 1, 1),
        );

        const firstTransform = createTransform(0, 0, 0, 0);
        const secondTransform = createTransform(2.0001, 0, 0, 0);

        expect(checkOBBCollision(bounds, firstTransform, bounds, secondTransform)).toBe(false);
    });

    it('returns true for deep rotation overlap at 30 and 60 degrees', () => {
        const bounds = new THREE.Box3(
            new THREE.Vector3(-1.5, -0.5, -0.5),
            new THREE.Vector3(1.5, 0.5, 0.5),
        );

        const firstTransform = createTransform(0, 0, 0, Math.PI / 6);
        const secondTransform = createTransform(0.35, 0, 0.1, Math.PI / 3);

        expect(checkOBBCollision(bounds, firstTransform, bounds, secondTransform)).toBe(true);
    });

    it('rejects a spawn attempt that overlaps a rotated existing module', () => {
        const spawnBounds = new THREE.Box3(
            new THREE.Vector3(-3, 0, -0.1),
            new THREE.Vector3(3, 1.2, 0.1),
        );
        const spawnTransform = createTransform(0.2, 0, -2.4, 0);

        const existingTransform = createTransform(0, 0, 0, Math.PI / 2);
        const existingBounds = new THREE.Box3(
            new THREE.Vector3(-3, -0.1, -0.1),
            new THREE.Vector3(3, 0.1, 0.1),
        );

        expect(checkOBBCollision(spawnBounds, spawnTransform, existingBounds, existingTransform)).toBe(true);
    });

    it('tracks and resets collision metric summaries', () => {
        const metrics = createEmptyCollisionMetrics();

        recordCollisionMetric(metrics, 'aabb', 2);
        recordCollisionMetric(metrics, 'aabb', 4);
        recordCollisionMetric(metrics, 'obb', 1);

        expect(metrics.aabb.samples).toBe(2);
        expect(metrics.aabb.totalMs).toBe(6);
        expect(metrics.aabb.averageMs).toBe(3);
        expect(metrics.aabb.minMs).toBe(2);
        expect(metrics.aabb.maxMs).toBe(4);
        expect(metrics.aabb.p50Ms).toBe(2);
        expect(metrics.aabb.p95Ms).toBe(2);
        expect(metrics.aabb.recentDurationsMs).toEqual([2, 4]);

        expect(metrics.obb.samples).toBe(1);
        expect(metrics.obb.totalMs).toBe(1);

        resetCollisionMetrics(metrics);

        expect(metrics.aabb.samples).toBe(0);
        expect(metrics.aabb.totalMs).toBe(0);
        expect(metrics.aabb.recentDurationsMs).toEqual([]);
        expect(metrics.obb.samples).toBe(0);
        expect(metrics.obb.totalMs).toBe(0);
    });

    it('trims old collision metric samples once the buffer is full', () => {
        const metrics = createEmptyCollisionMetrics();

        for (let index = 0; index <= 2000; index += 1) {
            recordCollisionMetric(metrics, 'aabb', index);
        }

        expect(metrics.aabb.samples).toBe(2001);
        expect(metrics.aabb.recentDurationsMs).toHaveLength(2000);
        expect(metrics.aabb.recentDurationsMs[0]).toBe(1);
        expect(metrics.aabb.recentDurationsMs.at(-1)).toBe(2000);
    });

    it('computes percentiles for empty and populated arrays', () => {
        expect(percentile([], 0.5)).toBe(0);
        expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
        expect(percentile([1, 2, 3, 4], 0.95)).toBe(3);
    });
});
