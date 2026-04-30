import * as THREE from 'three';
import type { ModelData, SnapConfig, SnapPointDefinition, SnapRule } from '../utilities/types';

export class SnapManager {
    private config: SnapConfig | null = null;
    private loadPromise: Promise<void> | null = null;

    public async loadConfig(): Promise<void> {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = fetch('/config/snap-config.json')
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load snap config: ${response.status}`);
                }
                return response.json() as Promise<SnapConfig>;
            })
            .then((config) => {
                this.config = config;
            })
            .catch((error) => {
                console.error('SnapManager: Failed to load config', error);
                this.config = null;
            });

        return this.loadPromise;
    }

    public getSnappedPosition(movingModel: ModelData, candidatePosition: THREE.Vector3, models: ModelData[]): THREE.Vector3 {
        if (!this.config) {
            return candidatePosition;
        }

        const movingDefinition = this.config.models[movingModel.modelKey];
        if (!movingDefinition || movingDefinition.points.length === 0) {
            return candidatePosition;
        }

        const defaultSnapDistance = this.config.defaultSnapDistance ?? 0.5;
        let bestMatch: { distance: number; delta: THREE.Vector3 } | null = null;

        for (const otherModel of models) {
            if (otherModel.id === movingModel.id) {
                continue;
            }

            const otherDefinition = this.config.models[otherModel.modelKey];
            if (!otherDefinition || otherDefinition.points.length === 0) {
                continue;
            }

            for (const movingPoint of movingDefinition.points) {
                for (const otherPoint of otherDefinition.points) {
                    const rule = this.getRule(movingPoint.type, otherPoint.type);
                    if (!rule) {
                        continue;
                    }

                    const snapDistance = rule.snapDistance ?? defaultSnapDistance;
                    const movingWorld = this.getWorldSnapPoint(
                        movingModel,
                        movingPoint,
                        candidatePosition
                    );
                    const otherWorld = this.getWorldSnapPoint(otherModel, otherPoint);
                    const distance = movingWorld.distanceTo(otherWorld);

                    if (distance <= snapDistance) {
                        if (!bestMatch || distance < bestMatch.distance) {
                            const delta = otherWorld.clone().sub(movingWorld);
                            bestMatch = { distance, delta };
                        }
                    }
                }
            }
        }

        if (!bestMatch) return candidatePosition;

        return candidatePosition.clone().add(bestMatch.delta);
    }

    public checkCompatibility(movingModel: ModelData, otherModel: ModelData): boolean {
        if (!this.config) {
            return false;
        }

        const movingDefinition = this.config.models[movingModel.modelKey];
        const otherDefinition = this.config.models[otherModel.modelKey];

        if (!movingDefinition || !otherDefinition) {
            return false;
        }

        for (const movingPoint of movingDefinition.points) {
            for (const otherPoint of otherDefinition.points) {
                if (this.getRule(movingPoint.type, otherPoint.type)) {
                    return true;
                }
            }
        }

        return false;
    }

    private getRule(typeA: string, typeB: string): SnapRule | null {
        if (!this.config) return null;

        for (const rule of this.config.rules) {
            const matchesForward = rule.typeA === typeA && rule.typeB === typeB;
            const matchesBackward = rule.typeA === typeB && rule.typeB === typeA;
            if (matchesForward || matchesBackward) return rule;
        }

        return null;
    }

    private getWorldSnapPoint(model: ModelData, point: SnapPointDefinition, positionOverride?: THREE.Vector3): THREE.Vector3 {
        const localPoint = this.getLocalSnapPoint(model, point);
        const position = positionOverride ?? model.object.position;
        const matrix = new THREE.Matrix4().compose(
            position,
            model.object.quaternion,
            model.object.scale
        );

        return localPoint.applyMatrix4(matrix);
    }

    private getLocalSnapPoint(model: ModelData, point: SnapPointDefinition): THREE.Vector3 {
        const bounds = model.bounds.box;
        const y = bounds.min.y;
        let x = 0;
        let z = 0;

        switch (point.side) {
            case 'left':
                x = bounds.min.x;
                break;
            case 'right':
                x = bounds.max.x;
                break;
            case 'front':
                z = bounds.max.z;
                break;
            case 'back':
                z = bounds.min.z;
                break;
        }

        if (point.side === 'left' || point.side === 'right') {
            if (point.depthSide === 'front') {
                z = bounds.max.z;
            } else if (point.depthSide === 'back') {
                z = bounds.min.z;
            }
        }

        if (point.side === 'front' || point.side === 'back') {
            if (point.widthSide === 'left') {
                x = bounds.min.x;
            } else if (point.widthSide === 'right') {
                x = bounds.max.x;
            }
        }

        return new THREE.Vector3(x, y, z);
    }
}
