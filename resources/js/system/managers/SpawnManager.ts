import * as THREE from 'three';
import type { Ref } from 'vue';
import type { ModelData } from '../utilities/types';
import {
    DEFAULT_COLLISION_MODE,
    checkAABBCollision,
    checkOBBCollision,
    measureCollisionCheck,
    type CollisionTransform,
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
    public findSpawnPosition(
        newModelSize: THREE.Vector3,
        rotation?: { x: number; y: number; z: number },
        scale?: { x: number; y: number; z: number }
    ): THREE.Vector3 {
        const origin = new THREE.Vector3(0, 0, 0);

        if (this.isPositionValid(origin, newModelSize, rotation, scale)) {
            return origin;
        }

        // Search spawn position spiraling outward from origin
        let closestCandidate: { position: THREE.Vector3; distance: number } | null = null;

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const candidate = this.generateSpiralPosition(attempt);
            const distance = candidate.distanceTo(origin);

            if (this.isPositionValid(candidate, newModelSize, rotation, scale)) {
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
    private isPositionValid(
        position: THREE.Vector3,
        newModelSize: THREE.Vector3,
        rotation?: { x: number; y: number; z: number },
        scale?: { x: number; y: number; z: number }
    ): boolean {
        const scaledSize = scale
            ? newModelSize.clone().multiply(new THREE.Vector3(scale.x, scale.y, scale.z))
            : newModelSize.clone();

        const spawnBounds = new THREE.Box3(
            new THREE.Vector3(
                -scaledSize.x / 2,
                0,
                -scaledSize.z / 2
            ),
            new THREE.Vector3(
                scaledSize.x / 2,
                scaledSize.y,
                scaledSize.z / 2
            )
        );

        const measurement = measureCollisionCheck(() => {
            return this.collisionMode === 'obb'
                ? this.validateWithObb(spawnBounds, position, rotation)
                : this.validateWithAabb(spawnBounds, position);
        });

        recordCollisionMetric(
            this.collisionMetrics,
            this.collisionMode,
            measurement.elapsedMicroseconds / 1000
        );

        return measurement.result;
    }

    private validateWithAabb(newBox: THREE.Box3, position: THREE.Vector3): boolean {
        // Central collision hub: SpawnManager and InteractionManager must agree on geometry rules.
        for (const modelData of this.models.value) {
            const existingBounds = modelData.cachedBounds ?? modelData.bounds.box;
            if (checkAABBCollision(
                newBox,
                position,
                existingBounds,
                modelData.object.position
            )) {
                return false;
            }
        }

        return true;
    }

    private validateWithObb(
        newBox: THREE.Box3,
        position: THREE.Vector3,
        rotation?: { x: number; y: number; z: number }
    ): boolean {
        const spawnTransform: CollisionTransform = {
            position,
            quaternion: rotation
                ? new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z))
                : new THREE.Quaternion(),
            scale: new THREE.Vector3(1, 1, 1),
        };

        for (const modelData of this.models.value) {
            if (checkOBBCollision(
                newBox,
                spawnTransform,
                modelData.bounds.box,
                {
                    position: modelData.object.position,
                    quaternion: modelData.object.quaternion,
                    scale: modelData.object.scale,
                }
            )) {
                return false;
            }
        }

        return true;
    }
}
