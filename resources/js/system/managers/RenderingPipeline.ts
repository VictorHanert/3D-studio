import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CONTROLS_CONFIG } from '../utilities/constants';

export interface FrameMetrics {
    samples: number;
    averageFrameMs: number;
    minFrameMs: number;
    maxFrameMs: number;
    p50FrameMs: number;
    p95FrameMs: number;
    averageFps: number;
    p50Fps: number;
    p95Fps: number;
}

interface FrameMetricsAccumulator {
    samples: number;
    totalFrameMs: number;
    minFrameMs: number;
    maxFrameMs: number;
    recentFrameDurations: number[];
}

export class RenderingPipeline {
    private animationId: number | null = null;
    private controls: OrbitControls | null = null;
    private lastFrameTime: number | null = null;
    private readonly maxFrameSamples: number = 4000;
    private readonly frameMetrics: FrameMetricsAccumulator = {
        samples: 0,
        totalFrameMs: 0,
        minFrameMs: Number.POSITIVE_INFINITY,
        maxFrameMs: 0,
        recentFrameDurations: [],
    };

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

        const animate = (timestamp: number): void => {
            this.animationId = requestAnimationFrame(animate);

            if (this.lastFrameTime !== null) {
                const frameMs = timestamp - this.lastFrameTime;
                this.recordFrameMetrics(frameMs);
            }
            this.lastFrameTime = timestamp;

            this.controls?.update();
            renderer.render(scene, camera);
        };
        this.animationId = requestAnimationFrame(animate);
    }

    public stopRenderLoop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.lastFrameTime = null;
    }

    public getControls(): OrbitControls | null {
        return this.controls;
    }

    public cleanup(): void {
        this.stopRenderLoop();
        this.controls?.dispose();
        this.controls = null;
    }

    public resetFrameMetrics(): void {
        this.frameMetrics.samples = 0;
        this.frameMetrics.totalFrameMs = 0;
        this.frameMetrics.minFrameMs = Number.POSITIVE_INFINITY;
        this.frameMetrics.maxFrameMs = 0;
        this.frameMetrics.recentFrameDurations = [];
    }

    public getFrameMetrics(): FrameMetrics {
        if (this.frameMetrics.samples === 0) {
            return {
                samples: 0,
                averageFrameMs: 0,
                minFrameMs: 0,
                maxFrameMs: 0,
                p50FrameMs: 0,
                p95FrameMs: 0,
                averageFps: 0,
                p50Fps: 0,
                p95Fps: 0,
            };
        }

        const sorted = [...this.frameMetrics.recentFrameDurations].sort((a, b) => a - b);
        const averageFrameMs = this.frameMetrics.totalFrameMs / this.frameMetrics.samples;
        const p50FrameMs = this.percentile(sorted, 0.5);
        const p95FrameMs = this.percentile(sorted, 0.95);

        return {
            samples: this.frameMetrics.samples,
            averageFrameMs,
            minFrameMs: this.frameMetrics.minFrameMs,
            maxFrameMs: this.frameMetrics.maxFrameMs,
            p50FrameMs,
            p95FrameMs,
            averageFps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
            p50Fps: p50FrameMs > 0 ? 1000 / p50FrameMs : 0,
            p95Fps: p95FrameMs > 0 ? 1000 / p95FrameMs : 0,
        };
    }

    private recordFrameMetrics(frameMs: number): void {
        this.frameMetrics.samples += 1;
        this.frameMetrics.totalFrameMs += frameMs;
        this.frameMetrics.minFrameMs = Math.min(this.frameMetrics.minFrameMs, frameMs);
        this.frameMetrics.maxFrameMs = Math.max(this.frameMetrics.maxFrameMs, frameMs);

        this.frameMetrics.recentFrameDurations.push(frameMs);
        if (this.frameMetrics.recentFrameDurations.length > this.maxFrameSamples) {
            this.frameMetrics.recentFrameDurations.shift();
        }
    }

    private percentile(sortedValues: number[], ratio: number): number {
        if (sortedValues.length === 0) {
            return 0;
        }

        const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * ratio)));
        return sortedValues[index];
    }
}
