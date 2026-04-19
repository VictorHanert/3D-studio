import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CONTROLS_CONFIG } from '../utilities/constants';

export class RenderingPipeline {
    private animationId: number | null = null;
    private controls: OrbitControls | null = null;

    public setupControls(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): OrbitControls {
        this.controls = new OrbitControls(camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = CONTROLS_CONFIG.DAMPING_FACTOR;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.maxPolarAngle = CONTROLS_CONFIG.MAX_POLAR_ANGLE;
        this.controls.minDistance = CONTROLS_CONFIG.MIN_DISTANCE;
        this.controls.maxDistance = CONTROLS_CONFIG.MAX_DISTANCE;

        return this.controls;
    }

    public startRenderLoop(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
        if (!this.controls) {
            console.error('Controls not initialized. Call setupControls first.');
            return;
        }

        const animate = (): void => {
            this.animationId = requestAnimationFrame(animate);
            this.controls?.update();
            renderer.render(scene, camera);
        };
        animate();
    }

    public stopRenderLoop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public getControls(): OrbitControls | null {
        return this.controls;
    }

    public cleanup(): void {
        this.stopRenderLoop();
        this.controls?.dispose();
        this.controls = null;
    }
}
