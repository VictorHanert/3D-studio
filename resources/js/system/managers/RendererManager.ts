import * as THREE from 'three';

export class RendererManager {
    private renderer: THREE.WebGLRenderer | null = null;
    private resizeHandler: (() => void) | null = null;
    private static activeContexts = 0;
    private static readonly MAX_CONTEXTS = 8; // Estimate 

    public createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
        if (this.renderer) {
            this.renderer.dispose();
        }

        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.resizeToDisplaySize();

        RendererManager.activeContexts++;
        
        // Monitor context limits
        const usagePercent = (RendererManager.activeContexts / RendererManager.MAX_CONTEXTS) * 100;
        if (usagePercent >= 80) {
            console.warn(`High WebGL context usage: ${RendererManager.activeContexts}/${RendererManager.MAX_CONTEXTS} (${usagePercent.toFixed(0)}%)`);
        } else if (usagePercent >= 50) {
            console.info(`WebGL context usage: ${RendererManager.activeContexts}/${RendererManager.MAX_CONTEXTS}`);
        }

        return this.renderer;
    }

    public getRenderer(): THREE.WebGLRenderer | null {
        return this.renderer;
    }

    public setupResizeListener(onResize: () => void): void {
        this.resizeHandler = () => {
            if (this.resizeToDisplaySize()) {
                onResize();
            }
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    private resizeToDisplaySize(): boolean {
        if (!this.renderer) return false;

        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;

        if (needResize) {
            this.renderer.setSize(width, height, false);
        }
        return needResize;
    }

    public disposeRenderer(renderer: THREE.WebGLRenderer): void {
        renderer.dispose();
        RendererManager.activeContexts = Math.max(0, RendererManager.activeContexts - 1);
    }

    public cleanup(): void {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }
}
