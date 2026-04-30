import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import type { Ref } from 'vue';
import type { ModelData, ModelBounds } from '../utilities/types';
import { SceneManager } from './SceneManager';
import { SpawnManager } from './SpawnManager';
import { ResourceTracker } from '../utilities/ResourceTracker';
import type { CollisionMetrics, CollisionMode } from '../utilities/CollisionDetection';

/**
 * Manages loading, positioning, rotating, and deleting 3D models
 */
export class ModelManager {
    private readonly sceneManager: SceneManager;
    private readonly models: Ref<ModelData[]>;
    private readonly draggableMeshes: THREE.Mesh[];
    private readonly loader: GLTFLoader;
    private readonly spawnManager: SpawnManager;
    private readonly modelCache = new Map<string, THREE.Group>();
    private readonly pendingModelLoads = new Map<string, Promise<THREE.Group>>();
    private readonly resourceTrackers = new Map<string, ResourceTracker>();

    constructor(
        sceneManager: SceneManager,
        models: Ref<ModelData[]>,
        draggableMeshes: THREE.Mesh[]
    ) {
        this.sceneManager = sceneManager;
        this.models = models;
        this.draggableMeshes = draggableMeshes;
        this.loader = new GLTFLoader();
        this.spawnManager = new SpawnManager(models);
    }

    public setCollisionMode(mode: CollisionMode): void {
        this.spawnManager.setCollisionMode(mode);
    }

    public getCollisionMode(): CollisionMode {
        return this.spawnManager.getCollisionMode();
    }

    public getCollisionMetrics(): CollisionMetrics {
        return this.spawnManager.getCollisionMetrics();
    }

    public resetCollisionMetrics(): void {
        this.spawnManager.resetCollisionMetrics();
    }

    private async loadGLTFModel(path: string): Promise<THREE.Group> {
        // Check cache first
        if (this.modelCache.has(path)) {
            return this.modelCache.get(path)!.clone();
        }

        const pendingLoad = this.pendingModelLoads.get(path);
        if (pendingLoad) {
            return (await pendingLoad).clone();
        }

        const loadPromise = (async () => {
            // Load and cache, tracking resources
            const tracker = new ResourceTracker();
            const gltf = await this.loader.loadAsync(path);
            const model = tracker.track(gltf.scene);

            // Store original for cloning and track its resources
            this.modelCache.set(path, model);
            this.resourceTrackers.set(path, tracker);

            return model;
        })();

        this.pendingModelLoads.set(path, loadPromise);

        try {
            const model = await loadPromise;
            return model.clone();
        } finally {
            this.pendingModelLoads.delete(path);
        }
    }

    // Load a 3D model with saved position, rotation, and scale.
    public async loadModel(
        modelPath: string,
        position: THREE.Vector3 | null = null,
        rotation?: { x: number; y: number; z: number },
        scale?: { x: number; y: number; z: number }
    ): Promise<void> {
        if (!this.sceneManager.getScene()) return;

        // Validate model path
        if (!modelPath || typeof modelPath !== 'string') {
            console.error('Invalid model path:', modelPath);
            return;
        }

        try {
            const model = await this.loadGLTFModel(modelPath);
            model.scale.setScalar(1);

            const meshes: THREE.Mesh[] = [];
            model.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    meshes.push(child);
                }
            });

            this.alignModelToGround(model);

            // Calculate bounds BEFORE positioning
            const bounds = this.calculateModelBounds(model);

            // Find spawn position: uses provided position if restoring, otherwise calculates via SpawnManager
            const spawnPosition = position || this.spawnManager.findSpawnPosition(bounds.size);
            model.position.copy(spawnPosition);

            // Restore exact rotation and scale if provided (from saved configuration)
            if (rotation) {
                model.rotation.set(rotation.x, rotation.y, rotation.z);
            }
            if (scale) {
                model.scale.set(scale.x, scale.y, scale.z);
            }

            const cachedBounds = new THREE.Box3().setFromObject(model);
            cachedBounds.translate(model.position.clone().negate());

            // Generate unique ID and store path
            const modelId = `model_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            const modelKey = this.getModelKey(modelPath);
            model.userData.id = modelId;
            model.userData.modelPath = modelPath;

            const modelData: ModelData = {
                id: modelId,
                modelKey,
                object: model,
                bounds,
                cachedBounds,
                path: modelPath,
                meshes,
            };

            this.sceneManager.addObject(model);
            this.models.value.push(modelData);
            this.draggableMeshes.push(...meshes);

            console.log('Total models in the scene:', this.models.value.length);
        } catch (error) {
            console.error('Error loading model from:', modelPath, error);
        }
    }

    private calculateModelBounds(model: THREE.Group): ModelBounds {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        box.translate(model.position.clone().negate());
        return { box: box.clone(), size };
    }

    private alignModelToGround(model: THREE.Group): void {
        const bounds = new THREE.Box3().setFromObject(model);
        const offset = bounds.min.y;
        if (offset !== 0) {
            model.position.y -= offset;
        }
    }

    private getModelKey(modelPath: string): string {
        const sanitized = modelPath.split('?')[0].replace(/\/+$/, '');
        const parts = sanitized.split('/');
        const lastPart = parts[parts.length - 1] || '';

        if (lastPart.toLowerCase().endsWith('.gltf') || lastPart.toLowerCase().endsWith('.glb')) {
            return parts[parts.length - 2] || lastPart;
        }

        return lastPart;
    }

    public rotateModel(modelId: string): void {
        const model = this.models.value.find((m) => m.id === modelId);
        if (!model) return;

        model.object.rotation.y += Math.PI / 2;

        model.cachedBounds = new THREE.Box3().setFromObject(model.object);
        model.cachedBounds.translate(model.object.position.clone().negate());
    }

    public disposeModel(model: ModelData): void {
        // Dispose geometries and materials using ResourceTracker pattern
        model.meshes.forEach((mesh: THREE.Mesh) => {
            mesh.geometry?.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => {
                        this.disposeMaterial(m);
                    });
                } else {
                    this.disposeMaterial(mesh.material);
                }
            }
        });

        // Remove from scene
        model.object.clear();
        if (model.object.parent) {
            model.object.parent.remove(model.object);
        } else {
            this.sceneManager.removeObject(model.object);
        }

        // Remove from draggable meshes
        model.meshes.forEach((mesh: THREE.Mesh) => {
            const meshIndex = this.draggableMeshes.indexOf(mesh);
            if (meshIndex > -1) {
                this.draggableMeshes.splice(meshIndex, 1);
            }
        });
    }

    // Dispose a material and its textures thoroughly
    private disposeMaterial(material: THREE.Material): void {
        // Dispose textures in material properties
        for (const value of Object.values(material)) {
            if (value instanceof THREE.Texture) {
                value.dispose();
            }
        }

        // Dispose textures in uniforms
        if ((material as any).uniforms) {
            for (const uniform of Object.values((material as any).uniforms)) {
                if (uniform && typeof uniform === 'object') {
                    const uniformValue = (uniform as any).value;
                    if (uniformValue instanceof THREE.Texture) {
                        uniformValue.dispose();
                    } else if (Array.isArray(uniformValue)) {
                        uniformValue.forEach((item) => {
                            if (item instanceof THREE.Texture) {
                                item.dispose();
                            }
                        });
                    }
                }
            }
        }

        material.dispose(); // Dispose the material itself
    }

    // Clear all cached models to free up memory
    public clearModelCache(): void {
        this.pendingModelLoads.clear();

        for (const tracker of this.resourceTrackers.values()) {
            tracker.dispose();
        }

        this.modelCache.clear();
        this.resourceTrackers.clear();
        console.log('Model cache cleared');
    }
}
