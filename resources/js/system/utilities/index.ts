/**
 * System Entry Point
 * 
 * Central export hub for the Planner 3D configurator system.
 * Import everything you need from this single location.
 */

// Main Planner singleton
export { Planner } from '../Planner';

// Type definitions
export type {
    ModelData,
    ModelBounds,
    Position2D,
    Position3D,
    SerializedModel,
    ConfigurationData,
    ModuleInfo,
    MaterialInfo,
    ModuleListResponse,
    PlannerState,
} from './types';

// Constants
export {
    SCENE_CONFIG,
    CAMERA_CONFIG,
    CONTROLS_CONFIG,
    SHADOW_CONFIG,
    PERFORMANCE_CONFIG,
} from './constants';

// Managers (exported for testing/extending)
export { SceneManager } from '../managers/SceneManager';
export { CameraManager } from '../managers/CameraManager';
export { ModelManager } from '../managers/ModelManager';
export { InteractionManager } from '../managers/InteractionManager';
export { SnapManager } from '../managers/SnapManager';

// Utilities
export { ThumbnailGenerator } from './ThumbnailGenerator';
export { ResourceTracker } from './ResourceTracker';
