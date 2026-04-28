export type CollisionMode = 'aabb' | 'obb';

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
    target.minMs = Math.min(target.minMs, elapsedMs);
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

function percentile(sortedValues: number[], ratio: number): number {
    if (sortedValues.length === 0) {
        return 0;
    }

    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * ratio)));
    return sortedValues[index];
}
