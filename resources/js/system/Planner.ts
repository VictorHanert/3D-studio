import { reactive, toRef } from 'vue';
import * as THREE from 'three';

import { SceneManager } from './managers/SceneManager';
import { CameraManager } from './managers/CameraManager';
import { ModelManager } from './managers/ModelManager';
import { InteractionManager } from './managers/InteractionManager';
import { RendererManager } from './managers/RendererManager';
import { RenderingPipeline, type FrameMetrics } from './managers/RenderingPipeline';
import { SnapManager } from './managers/SnapManager';
import { PersistenceManager } from './managers/PersistenceManager';

import { GroundTextureManager, type GroundTextureType } from './utilities/GroundTextureManager';
import { ThumbnailGenerator } from './utilities/ThumbnailGenerator';
import type { PlannerState, ModuleListResponse, SerializedModel, ConfigurationData } from './utilities/types';
import { DEFAULT_COLLISION_MODE, type CollisionMetrics, type CollisionMode } from './utilities/CollisionDetection';

export class Planner {
    private static instance: Planner | null = null;

    public readonly state: PlannerState;
    private sceneManager: SceneManager | null = null;
    private cameraManager: CameraManager | null = null;
    private modelManager: ModelManager | null = null;
    private interactionManager: InteractionManager | null = null;
    private snapManager: SnapManager | null = null;
    private rendererManager: RendererManager;
    private renderingPipeline: RenderingPipeline;
    private persistenceManager: PersistenceManager;
    private autoSaveInterval: number | null = null;
    private isDirty: boolean = false;
    private thumbnailGenerator: ThumbnailGenerator;

    private constructor() {
        this.state = reactive<PlannerState>({
            models: [],
            hoveredModel: null,
            showControls: false,
            controlPosition: { x: 0, y: 0 },
            isInitialized: false,
            groundTextureType: 'neutral',
            collisionMode: DEFAULT_COLLISION_MODE,
        });

        this.rendererManager = new RendererManager();
        this.renderingPipeline = new RenderingPipeline();
        this.thumbnailGenerator = new ThumbnailGenerator();
        this.persistenceManager = new PersistenceManager();
    }

    public static getInstance(): Planner {
        if (!Planner.instance) {
            Planner.instance = new Planner();
        }
        return Planner.instance;
    }

    public static resetInstance(): void {
        if (Planner.instance) {
            Planner.instance.cleanup();
            Planner.instance = null;
        }
    }

    public init(canvas: HTMLCanvasElement): void {
        if (!canvas || this.state.isInitialized) return;

        const renderer = this.rendererManager.createRenderer(canvas);
        this.setupScene(canvas);
        this.setupManagers(renderer);
        this.setupAutoSave();
        this.setupRenderingPipeline(renderer);

        const savedConfig = this.persistenceManager.loadFromLocalStorage();
        if (savedConfig && savedConfig.length > 0) {
            this.loadFromConfiguration({ models: savedConfig });
        }

        const savedTextureType = this.loadGroundTexturePreference();
        if (savedTextureType) {
            void this.changeGroundTexture(savedTextureType);
        }

        const savedCollisionMode = this.loadCollisionModePreference();
        if (savedCollisionMode) {
            this.setCollisionMode(savedCollisionMode);
        }

        this.state.isInitialized = true;
    }

    private setupScene(canvas: HTMLCanvasElement): void {
        this.sceneManager = new SceneManager();
        this.sceneManager.setupScene();
        this.sceneManager.setupGround();
        this.sceneManager.setupLights();

        this.cameraManager = new CameraManager(canvas);
        this.cameraManager.setupCamera();
    }

    private setupManagers(renderer: THREE.WebGLRenderer): void {
        const camera = this.cameraManager!.getCamera();
        if (!camera || !this.sceneManager) return;

        const controls = this.renderingPipeline.setupControls(camera, renderer);

        this.snapManager = new SnapManager();
        void this.snapManager.loadConfig();

        this.interactionManager = new InteractionManager(
            camera,
            renderer,
            controls,
            toRef(this.state, 'models'),
            [],
            toRef(this.state, 'hoveredModel'),
            toRef(this.state, 'showControls'),
            toRef(this.state, 'controlPosition'),
            this.snapManager
        );
        this.interactionManager.setupInteractions();

        this.modelManager = new ModelManager(
            this.sceneManager,
            toRef(this.state, 'models'),
            this.interactionManager.draggableMeshes
        );
    }

    private setupRenderingPipeline(renderer: THREE.WebGLRenderer): void {
        const scene = this.sceneManager!.getScene();
        const camera = this.cameraManager!.getCamera();

        if (!scene || !camera) return;

        this.renderingPipeline.startRenderLoop(renderer, scene, camera);

        this.rendererManager.setupResizeListener(() => {
            this.cameraManager?.updateAspect();
        });
    }

    // Auto-save every 3s if state changed via dirty flag
    private setupAutoSave(): void {
        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty) {
                this.isDirty = false;
                this.persistenceManager.autoSave(this.serializeModels());
            }
        }, 3000);
    }

    public async loadModel(
        modelPath: string,
        position: THREE.Vector3 | null = null,
        rotation?: { x: number; y: number; z: number },
        scale?: { x: number; y: number; z: number }
    ): Promise<void> {
        if (!this.modelManager) {
            console.error('ModelManager not initialized. Call init() first.');
            return;
        }
        await this.modelManager.loadModel(modelPath, position, rotation, scale);
        this.isDirty = true;
    }

    public rotateModel(modelId: string): void {
        if (!this.modelManager) return;
        this.modelManager.rotateModel(modelId);
        this.isDirty = true;
    }

    public deleteModel(modelId: string): void {
        if (!this.modelManager) return;
        const modelIndex = this.state.models.findIndex(m => m.id === modelId);
        if (modelIndex === -1) return;

        const model = this.state.models[modelIndex];
        this.modelManager.disposeModel(model);
        this.state.models.splice(modelIndex, 1);

        if (this.state.hoveredModel === model) {
            this.state.hoveredModel = null;
            this.state.showControls = false;
        }

        this.isDirty = true;
        console.log('Model deleted. Total models:', this.state.models.length);
    }

    public async saveToBackend(configName: string = 'My Configuration'): Promise<boolean> {
        const serialized = this.serializeModels();
        return await this.persistenceManager.saveToBackend(serialized, configName);
    }

    public clearAll(): void {
        const models = [...this.state.models];
        for (let i = models.length - 1; i >= 0; i--) {
            this.deleteModel(models[i].id);
        }
        this.persistenceManager.clearLocalStorage();
    }

    public async changeGroundTexture(textureType: GroundTextureType): Promise<void> {
        if (!this.sceneManager) return;
        await this.sceneManager.changeGroundTexture(textureType);
        this.state.groundTextureType = textureType;
        localStorage.setItem('planner.groundTexture', textureType);
    }

    private loadGroundTexturePreference(): GroundTextureType | null {
        const saved = localStorage.getItem('planner.groundTexture');
        return saved as GroundTextureType | null;
    }

    public setCollisionMode(mode: CollisionMode): void {
        this.state.collisionMode = mode;
        this.modelManager?.setCollisionMode(mode);
        this.interactionManager?.setCollisionMode(mode);
        localStorage.setItem('planner.collisionMode', mode);
    }

    public getCollisionMode(): CollisionMode {
        return this.state.collisionMode;
    }

    public resetCollisionMetrics(): void {
        this.modelManager?.resetCollisionMetrics();
        this.interactionManager?.resetCollisionMetrics();
    }

    public resetFrameMetrics(): void {
        this.renderingPipeline.resetFrameMetrics();
    }

    public getCollisionMetrics(): { spawn: CollisionMetrics | null; interaction: CollisionMetrics | null } {
        return {
            spawn: this.modelManager?.getCollisionMetrics() ?? null,
            interaction: this.interactionManager?.getCollisionMetrics() ?? null,
        };
    }

    public getFrameMetrics(): FrameMetrics {
        return this.renderingPipeline.getFrameMetrics();
    }

    public getBenchmarkReport(): {
        timestamp: string;
        collisionMode: CollisionMode;
        frame: FrameMetrics;
        collision: { spawn: CollisionMetrics | null; interaction: CollisionMetrics | null };
        warnings: string[];
    } {
        const collision = this.getCollisionMetrics();
        const frame = this.getFrameMetrics();
        const mode = this.getCollisionMode();
        const warnings: string[] = [];

        const spawnSamples = collision.spawn?.[mode].samples ?? 0;
        const interactionSamples = collision.interaction?.[mode].samples ?? 0;

        if (spawnSamples === 0) {
            warnings.push('No spawn samples collected in current mode. Add models after reset to benchmark spawn.');
        }
        if (interactionSamples === 0) {
            warnings.push('No interaction samples collected in current mode. Drag models after reset to benchmark interaction.');
        }
        if (frame.samples === 0) {
            warnings.push('No frame samples collected yet. Let the scene run for a few seconds before logging.');
        }

        return {
            timestamp: new Date().toISOString(),
            collisionMode: mode,
            frame,
            collision,
            warnings,
        };
    }

    private loadCollisionModePreference(): CollisionMode | null {
        const saved = localStorage.getItem('planner.collisionMode');
        if (saved === 'aabb' || saved === 'obb') {
            return saved;
        }

        return null;
    }

    // Serialize all models to persistence format
    public serializeModels(): SerializedModel[] {
        return this.state.models.map((model) => ({
            path: model.path,
            position: {
                x: model.object.position.x,
                y: model.object.position.y,
                z: model.object.position.z,
            },
            rotation: {
                x: model.object.rotation.x,
                y: model.object.rotation.y,
                z: model.object.rotation.z,
            },
            scale: {
                x: model.object.scale.x,
                y: model.object.scale.y,
                z: model.object.scale.z,
            },
        }));
    }

    public async loadFromConfiguration(config: ConfigurationData): Promise<void> {
        if (!config || !config.models) return;

        for (const savedModel of config.models) {
            const savedPosition = new THREE.Vector3(
                savedModel.position.x,
                savedModel.position.y,
                savedModel.position.z
            );

            await this.loadModel(
                savedModel.path,
                savedPosition,
                savedModel.rotation,
                savedModel.scale
            );
        }
    }

    public generateThumbnail(modelPath: string, size: number = 128): Promise<string> {
        return this.thumbnailGenerator.generateThumbnail(modelPath, size);
    }

    public async loadModuleList(): Promise<ModuleListResponse> {
        try {
            const response = await fetch('/api/modules');
            if (!response.ok) throw new Error('Failed to load modules');
            return await response.json();
        } catch (error) {
            console.error('Error loading modules:', error);
            return { modules: [], materials: [] };
        }
    }

    public async getUserConfigurations(): Promise<any[]> {
        return this.persistenceManager.getUserConfigurations();
    }

    public async loadConfigurationByCode(code: string): Promise<boolean> {
        const configData = await this.persistenceManager.loadFromBackendByCode(code);
        if (configData) {
            await this.loadFromConfiguration({ models: configData });
            return true;
        }
        return false;
    }

    public clearCanvasForNewConfig(): void {
        const models = [...this.state.models];
        for (let i = models.length - 1; i >= 0; i--) {
            this.deleteModel(models[i].id);
        }

        // Clear model cache when loading a new configuration
        if (this.modelManager) {
            this.modelManager.clearModelCache();
        }
    }

    public cleanup(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        this.isDirty = false;

        // Clean all models first
        const models = [...this.state.models];
        for (let i = models.length - 1; i >= 0; i--) {
            this.deleteModel(models[i].id);
        }

        // Clear model cache
        if (this.modelManager) {
            this.modelManager.clearModelCache();
        }

        // Clear texture cache
        GroundTextureManager.clearCache();

        this.sceneManager?.cleanup();
        this.interactionManager?.cleanup();
        this.renderingPipeline.cleanup();

        // Dispose WebGL renderer to free context
        const renderer = this.rendererManager.getRenderer();
        if (renderer) {
            this.rendererManager.disposeRenderer(renderer);
        }

        this.rendererManager.cleanup();

        this.state.models = [];
        this.state.hoveredModel = null;
        this.state.showControls = false;
        this.state.isInitialized = false;
    }
}
