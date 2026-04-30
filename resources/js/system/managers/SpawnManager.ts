import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import type { Ref } from 'vue';
import type { ModelData } from '../utilities/types';
import {
    DEFAULT_COLLISION_MODE,
    type CollisionMetrics,
    type CollisionMode,
    createEmptyCollisionMetrics,
    recordCollisionMetric,
    resetCollisionMetrics,
} from '../utilities/CollisionDetection';

/**
 * Manages smart model spawning with collision detection
 * Always tries origin first, then finds closest available position
 */
export class SpawnManager {
    private readonly models: Ref<ModelData[]>;
    private readonly maxAttempts: number = 100;
    private collisionMode: CollisionMode = DEFAULT_COLLISION_MODE;
    private readonly collisionMetrics: CollisionMetrics = createEmptyCollisionMetrics();

    constructor(models: Ref<ModelData[]>) {
        this.models = models;
    }

    public setCollisionMode(mode: CollisionMode): void {
        this.collisionMode = mode;
    }

    public getCollisionMode(): CollisionMode {
        return this.collisionMode;
    }

    public getCollisionMetrics(): CollisionMetrics {
        return this.collisionMetrics;
    }

    public resetCollisionMetrics(): void {
        resetCollisionMetrics(this.collisionMetrics);
    }

    /**
     * Find best spawn position for a new model:
     * 1. Always checks origin (0,0,0) first - models may have been moved away
     * 2. If origin occupied, finds the CLOSEST available spot to center
     * 3. No collisions with existing models using current positions
     */
    public findSpawnPosition(newModelSize: THREE.Vector3): THREE.Vector3 {
        const origin = new THREE.Vector3(0, 0, 0);

        if (this.isPositionValid(origin, newModelSize)) {
            return origin;
        }

        // Search spawn position spiraling outward from origin
        let closestCandidate: { position: THREE.Vector3; distance: number } | null = null;

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const candidate = this.generateSpiralPosition(attempt);
            const distance = candidate.distanceTo(origin);

            if (this.isPositionValid(candidate, newModelSize)) {
                // Keep track of the closest valid position found
                if (!closestCandidate || distance < closestCandidate.distance) {
                    closestCandidate = { position: candidate, distance };
                }
            }
        }

        if (closestCandidate) {
            return closestCandidate.position;
        }

        console.warn('SpawnManager: No valid spawn position found, placing far from origin');
        return new THREE.Vector3(this.models.value.length * 5, 0, 0);
    }

    // Generate position in a spiral pattern using golden angle
    private generateSpiralPosition(attempt: number): THREE.Vector3 {
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
        const angle = attempt * goldenAngle;
        const radius = Math.sqrt(attempt) * 0.5;

        return new THREE.Vector3(
            radius * Math.cos(angle),
            0,
            radius * Math.sin(angle)
        );
    }

    // Check if a position is valid (no collisions with existing models)
    private isPositionValid(position: THREE.Vector3, newModelSize: THREE.Vector3): boolean {
        const startTime = performance.now();

        // Create bounding box for the new model at this position
        const newBox = new THREE.Box3(
            new THREE.Vector3(
                position.x - newModelSize.x / 2,
                position.y,
                position.z - newModelSize.z / 2
            ),
            new THREE.Vector3(
                position.x + newModelSize.x / 2,
                position.y + newModelSize.y,
                position.z + newModelSize.z / 2
            )
        );

        const isValid = this.collisionMode === 'obb'
            ? this.validateWithObb(newBox)
            : this.validateWithAabb(newBox);

        const elapsedMs = performance.now() - startTime;
        recordCollisionMetric(this.collisionMetrics, this.collisionMode, elapsedMs);

        return isValid;
    }

    private validateWithAabb(newBox: THREE.Box3): boolean {
        // Check collision with ALL existing models at their current positions
        for (const modelData of this.models.value) {
            const existingBox = new THREE.Box3().setFromObject(modelData.object);

            if (newBox.intersectsBox(existingBox)) {
                return false;
            }
        }

        return true;
    }

    private validateWithObb(newBox: THREE.Box3): boolean {
        const newObb = new OBB().fromBox3(newBox);

        // Check collision with ALL existing models at their current positions
        for (const modelData of this.models.value) {
            const existingObb = this.createModelObb(modelData, modelData.object.position);

            if (newObb.intersectsOBB(existingObb)) {
                return false;
            }
        }

        return true;
    }

    private createModelObb(modelData: ModelData, position: THREE.Vector3): OBB {
        const obb = new OBB().fromBox3(modelData.bounds.box);
        const transform = new THREE.Matrix4().compose(
            position.clone(),
            modelData.object.quaternion.clone(),
            modelData.object.scale.clone()
        );

        obb.applyMatrix4(transform);
        return obb;
    }
}
