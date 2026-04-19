import * as THREE from 'three';

/**
 * Tracks and manages Three.js resources for proper cleanup
 *
 * Automatically discovers and tracks geometries, materials, and textures.
 * Prevents memory leaks by ensuring all resources are properly disposed.
 */
export class ResourceTracker {
    private resources: Set<any> = new Set();

    /**
     * Track a resource for cleanup. Recursively discovers child resources.
     * @param resource - The resource to track (geometries, materials, textures, or Object3D)
     * @returns The resource (unchanged, for chaining)
     */
    track<T>(resource: T): T {
        if (!resource) {
            return resource;
        }

        // Handle arrays (materials, children, textures in uniforms)
        if (Array.isArray(resource)) {
            resource.forEach((item) => this.track(item));
            return resource;
        }

        // Check if it's a disposable resource or Object3D
        const hasDispose = (resource as any).dispose || resource instanceof THREE.Object3D;
        if (hasDispose) {
            this.resources.add(resource as any);
        }

        // Recursively track children and materials from Object3D
        if (resource instanceof THREE.Object3D) {
            this.track((resource as any).geometry);
            this.track((resource as any).material);
            this.track(resource.children);
        }

        // Track textures and other resources in materials
        if (resource instanceof THREE.Material) {
            // Check all properties for textures
            for (const value of Object.values(resource)) {
                if (value instanceof THREE.Texture) {
                    this.track(value);
                }
            }

            // Check uniforms for textures and texture arrays
            if ((resource as any).uniforms) {
                for (const uniform of Object.values((resource as any).uniforms)) {
                    if (uniform && typeof uniform === 'object') {
                        const uniformValue = (uniform as any).value;
                        if (
                            uniformValue instanceof THREE.Texture
                            || Array.isArray(uniformValue)
                        ) {
                            this.track(uniformValue);
                        }
                    }
                }
            }
        }

        return resource;
    }

    /**
     * Stop tracking a specific resource (if you need to preserve it)
     * @param resource - The resource to untrack
     */
    untrack(resource: any): void {
        this.resources.delete(resource);
    }

    /**
     * Dispose all tracked resources and clear the tracker
     */
    dispose(): void {
        for (const resource of this.resources) {
            // Handle Object3D removal from scene
            if (resource instanceof THREE.Object3D) {
                if (resource.parent) {
                    resource.parent.remove(resource);
                }
            }

            // Dispose if method exists
            if ((resource as any).dispose) {
                (resource as any).dispose();
            }
        }

        this.resources.clear();
    }

    /**
     * Get the count of tracked resources
     */
    getResourceCount(): number {
        return this.resources.size;
    }

    /**
     * Check if currently tracking any resources
     */
    hasResources(): boolean {
        return this.resources.size > 0;
    }

    /**
     * Clear all tracked resources without disposing them
     * (Use with caution - manual cleanup required)
     */
    clear(): void {
        this.resources.clear();
    }
}
