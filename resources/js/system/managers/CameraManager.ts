import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utilities/constants';

/**
 * Manages the Three.js camera setup and aspect ratio updates
 */
export class CameraManager {
    public camera: THREE.PerspectiveCamera | null = null;
    private readonly canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    setupCamera(): void {
        if (!this.canvas) return;

        this.camera = new THREE.PerspectiveCamera(
            CAMERA_CONFIG.FOV,
            this.canvas.clientWidth / this.canvas.clientHeight,
            CAMERA_CONFIG.NEAR,
            CAMERA_CONFIG.FAR
        );

        const distance = CAMERA_CONFIG.DISTANCE;
        this.camera.position.set(
            distance * 0.7,
            distance * 0.6,
            distance * 0.7
        );
        this.camera.lookAt(0, 0, 0);
    }

    updateAspect(): void {
        if (!this.camera || !this.canvas) return;
        this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.updateProjectionMatrix();
    }

    getCamera(): THREE.PerspectiveCamera | null {
        return this.camera;
    }
}
