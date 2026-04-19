import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * Generates thumbnail previews for 3D models
 */
export class ThumbnailGenerator {
    private static activeContexts = 0;
    private static readonly MAX_CONTEXTS = 8;
    generateThumbnail(modelPath: string, size: number = 128): Promise<string> {
        return new Promise((resolve, reject) => {
            // Check context limit
            if (ThumbnailGenerator.activeContexts >= ThumbnailGenerator.MAX_CONTEXTS) {
                console.warn(`Too many active WebGL contexts (${ThumbnailGenerator.activeContexts}/${ThumbnailGenerator.MAX_CONTEXTS})`);
                reject(new Error('Too many active WebGL contexts'));
                return;
            }

            const thumbScene = new THREE.Scene();
            thumbScene.background = new THREE.Color(0xf8fafc);

            const thumbCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
            const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            thumbRenderer.setSize(size, size);

            ThumbnailGenerator.activeContexts++;

            const thumbLoader = new GLTFLoader();

            thumbLoader.load(
                modelPath,
                (gltf) => {
                    const model = gltf.scene;

                    const light1 = new THREE.DirectionalLight(0xffffff, 1);
                    light1.position.set(1, 2, 1);
                    thumbScene.add(light1);

                    const light2 = new THREE.AmbientLight(0xffffff, 0.5);
                    thumbScene.add(light2);

                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const sizeVec = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
                    const distance = maxDim / Math.tan((thumbCamera.fov * Math.PI) / 360);

                    thumbCamera.position.set(
                        center.x + distance * 0.7,
                        center.y + distance * 0.5,
                        center.z + distance * 0.7
                    );
                    thumbCamera.lookAt(center);

                    thumbScene.add(model);
                    thumbRenderer.render(thumbScene, thumbCamera);

                    const dataURL = thumbRenderer.domElement.toDataURL('image/png');

                    // Cleanup to prevent memory leaks
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.geometry?.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach((m) => m.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        }
                    });

                    thumbRenderer.dispose();
                    thumbScene.clear();

                    ThumbnailGenerator.activeContexts = Math.max(0, ThumbnailGenerator.activeContexts - 1);

                    resolve(dataURL);
                },
                undefined,
                (error) => {
                    // Cleanup on error
                    thumbRenderer.dispose();
                    thumbScene.clear();
                    ThumbnailGenerator.activeContexts = Math.max(0, ThumbnailGenerator.activeContexts - 1);
                    reject(error);
                }
            );
        });
    }
}
