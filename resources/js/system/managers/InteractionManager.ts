import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import type { OrbitControls } from 'three-stdlib';
import type { Ref } from 'vue';
import type { ModelData, Position2D } from '../utilities/types';
import { PERFORMANCE_CONFIG, SCENE_CONFIG } from '../utilities/constants';
import {
    DEFAULT_COLLISION_MODE,
    type CollisionMetrics,
    type CollisionMode,
    createEmptyCollisionMetrics,
    recordCollisionMetric,
    resetCollisionMetrics,
} from '../utilities/CollisionDetection';
import { SnapManager } from './SnapManager';

/**
 * Manages user interactions: drag, hover, and controls display
 */
export class InteractionManager {
    private readonly camera: THREE.PerspectiveCamera;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly controls: OrbitControls;
    private readonly models: Ref<ModelData[]>;
    public readonly draggableMeshes: THREE.Mesh[];
    private readonly hoveredModel: Ref<ModelData | null>;
    private readonly showControls: Ref<boolean>;
    private readonly controlPosition: Ref<Position2D>;
    private readonly groundHalf: number;
    private readonly snapManager: SnapManager | null;
    private collisionMode: CollisionMode = DEFAULT_COLLISION_MODE;
    private readonly collisionMetrics: CollisionMetrics = createEmptyCollisionMetrics();

    private readonly raycaster: THREE.Raycaster;
    private readonly pointer: THREE.Vector2;
    private readonly dragPlane: THREE.Plane;
    private readonly dragIntersection: THREE.Vector3;
    private readonly dragOffset: THREE.Vector3;
    private isDragging: boolean = false;
    private selectedModel: ModelData | null = null;
    private hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

    private lastRaycastTime: number = 0;
    private readonly raycastThrottle: number = PERFORMANCE_CONFIG.RAYCAST_THROTTLE;

    private handlePointerDown: ((event: PointerEvent) => void) | null = null;
    private handlePointerMove: ((event: PointerEvent) => void) | null = null;
    private handlePointerUp: (() => void) | null = null;

    constructor(
        camera: THREE.PerspectiveCamera,
        renderer: THREE.WebGLRenderer,
        controls: OrbitControls,
        models: Ref<ModelData[]>,
        draggableMeshes: THREE.Mesh[],
        hoveredModel: Ref<ModelData | null>,
        showControls: Ref<boolean>,
        controlPosition: Ref<Position2D>,
        snapManager: SnapManager | null,
        groundHalf: number = SCENE_CONFIG.GROUND_HALF
    ) {
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.models = models;
        this.draggableMeshes = draggableMeshes;
        this.hoveredModel = hoveredModel;
        this.showControls = showControls;
        this.controlPosition = controlPosition;
        this.groundHalf = groundHalf;
        this.snapManager = snapManager;

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.dragIntersection = new THREE.Vector3();
        this.dragOffset = new THREE.Vector3();
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

    setupInteractions(): void {
        this.handlePointerDown = (event: PointerEvent) => {
            this.updatePointerFromEvent(event);
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObjects(this.draggableMeshes, true);

            if (intersects.length > 0) {
                this.isDragging = true;
                this.controls.enabled = false;

                this.showControls.value = false;
                this.renderer.domElement.style.cursor = 'grabbing';

                const intersectedMesh = intersects[0].object as THREE.Mesh;
                this.selectedModel = this.findModelByMesh(intersectedMesh);

                if (this.selectedModel) {
                    this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection);
                    this.dragOffset.copy(this.dragIntersection).sub(this.selectedModel.object.position);
                }
            }
        };

        this.handlePointerMove = (event: PointerEvent) => {
            this.updatePointerFromEvent(event);

            if (this.selectedModel && this.isDragging) {
                this.raycaster.setFromCamera(this.pointer, this.camera);
                this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection);

                let newPosition = this.dragIntersection.clone().sub(this.dragOffset);
                newPosition = this.clampToGround(newPosition, this.selectedModel);
                newPosition = this.resolveCollisions(newPosition, this.selectedModel);

                if (this.snapManager) {
                    newPosition = this.snapManager.getSnappedPosition(
                        this.selectedModel,
                        newPosition,
                        this.models.value
                    );
                }

                this.selectedModel.object.position.copy(newPosition);
            } else {
                // Throttle raycasting for performance
                const now = Date.now();
                if (now - this.lastRaycastTime < this.raycastThrottle) return;
                this.lastRaycastTime = now;

                this.raycaster.setFromCamera(this.pointer, this.camera);
                const intersects = this.raycaster.intersectObjects(this.draggableMeshes, true);

                if (intersects.length > 0) {
                    this.renderer.domElement.style.cursor = 'grab';
                    const intersectedMesh = intersects[0].object as THREE.Mesh;
                    const model = this.findModelByMesh(intersectedMesh);

                    if (model && model !== this.hoveredModel.value) {
                        this.hoveredModel.value = model;
                        this.showControls.value = true;
                        const screenPos = this.convert3DTo2D(model.object.position);
                        this.controlPosition.value = { x: screenPos.x + 20, y: screenPos.y - 40 };

                        if (this.hideControlsTimeout) {
                            clearTimeout(this.hideControlsTimeout);
                        }
                    }
                } else {
                    this.renderer.domElement.style.cursor = 'default';
                    if (this.showControls.value && !this.isDragging) {
                        this.hideControlsTimeout = setTimeout(() => {
                            this.showControls.value = false;
                            this.hoveredModel.value = null;
                        }, 500);
                    }
                }
            }
        };

        this.handlePointerUp = () => {
            this.isDragging = false;
            this.selectedModel = null;
            this.controls.enabled = true;

            this.renderer.domElement.style.cursor = 'default';
        };

        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
        canvas.addEventListener('pointerleave', this.handlePointerUp);
    }

    private convert3DTo2D(worldPosition: THREE.Vector3): Position2D {
        const vector = worldPosition.clone();
        vector.project(this.camera);

        const canvas = this.renderer.domElement;
        const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;

        return { x, y };
    }

    private updatePointerFromEvent(event: PointerEvent): void {
        const bounds = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    }

    private clampToGround(position: THREE.Vector3, model: ModelData): THREE.Vector3 {
        const halfSize = model.bounds.size.clone().multiplyScalar(0.5);

        return new THREE.Vector3(
            Math.min(
                this.groundHalf - halfSize.x,
                Math.max(-this.groundHalf + halfSize.x, position.x)
            ),
            position.y,
            Math.min(
                this.groundHalf - halfSize.z,
                Math.max(-this.groundHalf + halfSize.z, position.z)
            )
        );
    }

    private resolveCollisions(position: THREE.Vector3, movingModel: ModelData): THREE.Vector3 {
        const startTime = performance.now();

        const resolvedPosition = this.collisionMode === 'obb'
            ? this.resolveCollisionsWithObb(position, movingModel)
            : this.resolveCollisionsWithAabb(position, movingModel);

        const elapsedMs = performance.now() - startTime;
        recordCollisionMetric(this.collisionMetrics, this.collisionMode, elapsedMs);

        return resolvedPosition;
    }

    private resolveCollisionsWithAabb(position: THREE.Vector3, movingModel: ModelData): THREE.Vector3 {
        const testBox = movingModel.cachedBounds.clone().translate(position);

        for (const otherModel of this.models.value) {
            if (otherModel.id === movingModel.id) {
                continue;
            }

            const otherBox = otherModel.cachedBounds.clone().translate(otherModel.object.position);

            if (testBox.intersectsBox(otherBox)) {
                // Check if boxes overlap
                const intersection = new THREE.Box3();
                intersection.copy(testBox).intersect(otherBox);

                const size = new THREE.Vector3();
                intersection.getSize(size);

                // If intersection has positive volume in all dimensions, they overlap
                if (size.x > 0 && size.y > 0 && size.z > 0) {
                    return movingModel.object.position.clone();
                }
                // Allow if intersection has zero volume in any dimension
            }
        }

        return position;
    }

    private resolveCollisionsWithObb(position: THREE.Vector3, movingModel: ModelData): THREE.Vector3 {
        const movingObb = this.createModelObb(movingModel, position);

        for (const otherModel of this.models.value) {
            if (otherModel.id === movingModel.id) {
                continue;
            }

            const otherObb = this.createModelObb(otherModel, otherModel.object.position);

            if (movingObb.intersectsOBB(otherObb)) {
                return movingModel.object.position.clone();
            }
        }

        return position;
    }

    private createModelObb(model: ModelData, position: THREE.Vector3): OBB {
        const obb = new OBB().fromBox3(model.bounds.box);
        const transform = new THREE.Matrix4().compose(
            position.clone(),
            model.object.quaternion.clone(),
            model.object.scale.clone()
        );

        obb.applyMatrix4(transform);
        return obb;
    }

    private findModelByMesh(mesh: THREE.Mesh): ModelData | null {
        for (const model of this.models.value) {
            if (model.meshes.includes(mesh)) {
                return model;
            }
        }
        return null;
    }

    cleanup(): void {
        if (this.hideControlsTimeout) {
            clearTimeout(this.hideControlsTimeout);
            this.hideControlsTimeout = null;
        }

        if (this.handlePointerDown) {
            const canvas = this.renderer.domElement;
            canvas.removeEventListener('pointerdown', this.handlePointerDown);
            canvas.removeEventListener('pointermove', this.handlePointerMove!);
            canvas.removeEventListener('pointerup', this.handlePointerUp!);
            canvas.removeEventListener('pointerleave', this.handlePointerUp!);
        }
    }
}
