/**
 * Configuration constants for the 3D scene
 */
export const SCENE_CONFIG = {
    GROUND_SIZE: 8,
    GROUND_HALF: 4,
    BACKGROUND_COLOR: 0xf8fafc,
    GROUND_COLOR: 0xf1f5f9,
} as const;

/**
 * Camera configuration
 */
export const CAMERA_CONFIG = {
    FOV: 45,
    NEAR: 0.1,
    FAR: 1000,
    DISTANCE: 8,
} as const;

/**
 * Controls configuration
 */
export const CONTROLS_CONFIG = {
    DAMPING_FACTOR: 0.1,
    MAX_POLAR_ANGLE: Math.PI / 2 - 0.1,
    MIN_DISTANCE: 2,
    MAX_DISTANCE: 50,
} as const;

/**
 * Shadow map configuration
 */
export const SHADOW_CONFIG = {
    MAP_SIZE: 1024,
} as const;

/**
 * Performance configuration
 */
export const PERFORMANCE_CONFIG = {
    RAYCAST_THROTTLE: 16, // ms
} as const;
