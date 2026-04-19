import * as THREE from 'three';
// import { RectAreaLight } from 'three';
import { SCENE_CONFIG } from '../utilities/constants';
import { GroundTextureManager, type GroundTextureType } from '../utilities/GroundTextureManager';

/**
 * Manages the Three.js scene, ground, and lighting setup
 */
export class SceneManager {
    public scene: THREE.Scene | null = null;
    private ground: THREE.Mesh | null = null;
    private groundMaterial: THREE.MeshStandardMaterial | null = null;
    private readonly backgroundColor: number;
    private readonly groundSize: number;
    private readonly groundColor: number;

    constructor(
        backgroundColor: number = SCENE_CONFIG.BACKGROUND_COLOR,
        groundSize: number = SCENE_CONFIG.GROUND_SIZE,
        groundColor: number = SCENE_CONFIG.GROUND_COLOR
    ) {
        this.backgroundColor = backgroundColor;
        this.groundSize = groundSize;
        this.groundColor = groundColor;
    }

    setupScene(): void {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.backgroundColor);
        this.scene.fog = new THREE.Fog(this.backgroundColor, 15, 30);
    }

    setupGround(): void {
        if (!this.scene) return;

        const planeGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize);
        
        this.groundMaterial = new THREE.MeshStandardMaterial({ 
            color: this.groundColor,
            roughness: 0.08,
            metalness: 0.15,
            envMapIntensity: 1.5
        });

        this.ground = new THREE.Mesh(planeGeometry, this.groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    setupLights(): void {
        if (!this.scene) return;

        // Ambient & Shadow Key
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
        keyLight.position.set(5, 15, 10);
        keyLight.castShadow = true;
        keyLight.shadow.radius = 10; 
        this.scene.add(keyLight);

        // Softbox RectAreaLight
        const width = 15;
        const height = 10;
        const rectLight = new THREE.RectAreaLight(0xffffff, 4.0, width, height);
        rectLight.position.set(0, 8, -12); 
        rectLight.lookAt(0, 0, 0);
        this.scene.add(rectLight);

        // Reflection light
        const reflectGeometry = new THREE.PlaneGeometry(width, height);
        const reflectMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            side: THREE.DoubleSide 
        });
        const reflectionPlane = new THREE.Mesh(reflectGeometry, reflectMaterial);
        reflectionPlane.position.copy(rectLight.position);
        reflectionPlane.quaternion.copy(rectLight.quaternion);
        reflectionPlane.position.z -= 0.01;
        this.scene.add(reflectionPlane);

        // Update Scene Environment
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        
        const renderTarget = pmremGenerator.fromScene(this.scene);
        this.scene.environment = renderTarget.texture;
        
        renderer.dispose();
    }

    addObject(object: THREE.Object3D): void {
        if (this.scene) {
            this.scene.add(object);
        }
    }

    removeObject(object: THREE.Object3D): void {
        if (this.scene) {
            this.scene.remove(object);
        }
    }

    cleanup(): void {
        if (!this.scene) return;

        // Dispose all objects in scene
        this.scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m: THREE.Material) => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });

        // Dispose ground
        if (this.ground) {
            this.ground.geometry?.dispose();
            if (this.ground.material instanceof THREE.Material) {
                this.ground.material.dispose();
            }
        }

        this.scene.clear();
    }

    async changeGroundTexture(textureType: GroundTextureType): Promise<void> {
        if (!this.ground) return;
        
        // Dispose old material
        if (this.groundMaterial) {
            this.groundMaterial.map?.dispose();
            this.groundMaterial.normalMap?.dispose();
            this.groundMaterial.roughnessMap?.dispose();
            this.groundMaterial.dispose();
        }

        // Get new PBR material
        this.groundMaterial = await GroundTextureManager.getMaterial(textureType);
        this.ground.material = this.groundMaterial;
    }

    getScene(): THREE.Scene | null {
        return this.scene;
    }
}
