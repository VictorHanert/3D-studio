import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

export type CollisionMode = 'aabb' | 'obb';

export interface CollisionTransform {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
}

export interface TimedCollisionCheck<T> {
    result: T;
    elapsedMicroseconds: number;
}

export interface CollisionMetricSummary {
    samples: number;
    totalMs: number;
    sumSquares: number;
    averageMs: number;
    minMs: number;
    lastMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    stdDevMs: number;
    recentDurationsMs: number[];
}

export interface CollisionMetrics {
    aabb: CollisionMetricSummary;
    obb: CollisionMetricSummary;
}

export const DEFAULT_COLLISION_MODE: CollisionMode = 'aabb';
const MAX_RECENT_SAMPLES = 2000;

export function checkAABBCollision(
    movingBounds: THREE.Box3,
    movingPosition: THREE.Vector3,
    otherBounds: THREE.Box3,
    otherPosition: THREE.Vector3
): boolean {
    const movedBox = movingBounds.clone().translate(movingPosition);
    const otherBox = otherBounds.clone().translate(otherPosition);

    return movedBox.intersectsBox(otherBox);
}

export function checkOBBCollision(
    movingBounds: THREE.Box3,
    movingTransform: CollisionTransform,
    otherBounds: THREE.Box3,
    otherTransform: CollisionTransform
): boolean {
    const movingObb = createWorldObb(movingBounds, movingTransform);
    const otherObb = createWorldObb(otherBounds, otherTransform);

    return movingObb.intersectsOBB(otherObb);
}

export function createWorldObb(bounds: THREE.Box3, transform: CollisionTransform): OBB {
    const obb = new OBB().fromBox3(bounds);
    const matrix = new THREE.Matrix4().compose(
        transform.position.clone(),
        transform.quaternion.clone(),
        transform.scale.clone()
    );

    obb.applyMatrix4(matrix);
    return obb;
}

export function measureCollisionCheck<T>(callback: () => T): TimedCollisionCheck<T> {
    const startMicroseconds = nowMicroseconds();
    const result = callback();

    return {
        result,
        elapsedMicroseconds: nowMicroseconds() - startMicroseconds,
    };
}

export function createEmptyCollisionMetrics(): CollisionMetrics {
    return {
        aabb: createEmptyMetricSummary(),
        obb: createEmptyMetricSummary(),
    };
}

export function recordCollisionMetric(metrics: CollisionMetrics, mode: CollisionMode, elapsedMs: number): void {
    const target = metrics[mode];

    target.samples += 1;
    target.totalMs += elapsedMs;
    target.sumSquares += elapsedMs * elapsedMs;
    target.minMs = target.samples === 1 ? elapsedMs : Math.min(target.minMs, elapsedMs);
    target.lastMs = elapsedMs;
    target.maxMs = Math.max(target.maxMs, elapsedMs);
    target.averageMs = target.totalMs / target.samples;

    target.recentDurationsMs.push(elapsedMs);
    if (target.recentDurationsMs.length > MAX_RECENT_SAMPLES) {
        target.recentDurationsMs.shift();
    }

    const sorted = [...target.recentDurationsMs].sort((a, b) => a - b);
    target.p50Ms = percentile(sorted, 0.5);
    target.p95Ms = percentile(sorted, 0.95);

    const variance = Math.max(0, target.sumSquares / target.samples - target.averageMs * target.averageMs);
    target.stdDevMs = Math.sqrt(variance);
}

export function resetCollisionMetrics(metrics: CollisionMetrics): void {
    metrics.aabb = createEmptyMetricSummary();
    metrics.obb = createEmptyMetricSummary();
}

function createEmptyMetricSummary(): CollisionMetricSummary {
    return {
        samples: 0,
        totalMs: 0,
        sumSquares: 0,
        averageMs: 0,
        minMs: 0,
        lastMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        stdDevMs: 0,
        recentDurationsMs: [],
    };
}

export function percentile(sortedValues: number[], ratio: number): number {
    if (sortedValues.length === 0) {
        return 0;
    }

    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * ratio)));
    return sortedValues[index];
}

function nowMicroseconds(): number {
    return performance.now() * 1000;
}
