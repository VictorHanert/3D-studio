import type * as THREE from 'three';
import type { GroundTextureType } from './GroundTextureManager';

/**
 * 3D model data structure stored in the scene
 */
export interface ModelData {
    id: string;
    modelKey: string;
    object: THREE.Group;
    bounds: ModelBounds;
    cachedBounds: THREE.Box3;
    path: string;
    meshes: THREE.Mesh[];
}

/**
 * Model bounding box information
 */
export interface ModelBounds {
    box: THREE.Box3;
    size: THREE.Vector3;
}

/**
 * 2D screen position
 */
export interface Position2D {
    x: number;
    y: number;
}

/**
 * 3D world position
 */
export interface Position3D {
    x: number;
    y: number;
    z: number;
}

/**
 * Serialized model for persistence
 */
export interface SerializedModel {
    path: string;
    position: Position3D;
    rotation: Position3D;
    scale: Position3D;
}

/**
 * Configuration data for save/load
 */
export interface ConfigurationData {
    models: SerializedModel[];
    timestamp?: string;
}

/**
 * Module information from backend
 */
export interface ModuleInfo {
    name: string;
    folder: string;
    thumbnail: string | null;
}

/**
 * Material information from backend
 */
export interface MaterialInfo {
    name: string;
    defaultFile: string;
}

/**
 * Module list response from API
 */
export interface ModuleListResponse {
    modules: ModuleInfo[];
    materials: MaterialInfo[];
}

/**
 * Planner reactive state
 */
export interface PlannerState {
    models: ModelData[];
    hoveredModel: ModelData | null;
    showControls: boolean;
    controlPosition: Position2D;
    isInitialized: boolean;
    groundTextureType: GroundTextureType;
}

export type SnapSide = 'left' | 'right' | 'front' | 'back';
export type SnapWidthSide = 'left' | 'right' | 'center';
export type SnapDepthSide = 'front' | 'back' | 'center';

export interface SnapPointDefinition {
    id: string;
    side: SnapSide;
    type: string;
    widthSide?: SnapWidthSide;
    depthSide?: SnapDepthSide;
}

export interface SnapModelDefinition {
    points: SnapPointDefinition[];
}

export interface SnapRule {
    typeA: string;
    typeB: string;
    snapDistance: number;
}

export interface SnapConfig {
    models: Record<string, SnapModelDefinition>;
    rules: SnapRule[];
    defaultSnapDistance?: number;
}
