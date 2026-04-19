import * as THREE from 'three';

export type GroundTextureType = 'neutral' | 'pine' | 'plum' | 'walnut';

interface TexturePreset {
    type: GroundTextureType;
    name: string;
    albedoPath?: string;
    normalPath?: string;
    roughnessPath?: string;
}

export const GROUND_TEXTURES: TexturePreset[] = [
    { type: 'neutral', name: 'Neutral' },
    { 
        type: 'pine', 
        name: 'Pine Wood',
        albedoPath: '/textures/Pine_Wood_2k_Albedo.jpg',
        normalPath: '/textures/Pine_Wood_2k_Normal.jpg',
        roughnessPath: '/textures/Pine_Wood_2k_Roughness.jpg'
    },
    { 
        type: 'plum', 
        name: 'Plum Floor',
        albedoPath: '/textures/Plum_Floor_2k_Albedo.jpg',
        normalPath: '/textures/Plum_Floor_2k_Normal.jpg',
        roughnessPath: '/textures/Plum_Floor_2k_Roughness.jpg'
    },
    { 
        type: 'walnut', 
        name: 'Scottish Walnuts Wood',
        albedoPath: '/textures/Scottish_Walnuts_Wood_2k_Albedo.jpg',
        normalPath: '/textures/Scottish_Walnuts_Wood_2k_Normal.jpg',
        roughnessPath: '/textures/Scottish_Walnuts_Wood_2k_Roughness.jpg'
    },
];

// Manages ground textures loaded from image files
export class GroundTextureManager {
    private static readonly MATERIAL_CACHE = new Map<GroundTextureType, THREE.MeshStandardMaterial>();
    private static readonly textureLoader = new THREE.TextureLoader();
    private static readonly NEUTRAL_COLOR = 0xede8e3;

    /**
     * Get or create a material with PBR textures for the given type
     */
    public static async getMaterial(type: GroundTextureType): Promise<THREE.MeshStandardMaterial> {
        if (this.MATERIAL_CACHE.has(type)) {
            return this.MATERIAL_CACHE.get(type)!;
        }

        const preset = GROUND_TEXTURES.find(t => t.type === type);
        
        if (!preset || !preset.albedoPath) {
            // Return a material with neutral color for neutral type
            const material = new THREE.MeshStandardMaterial({ 
                color: this.NEUTRAL_COLOR,
                roughness: 0.8,
                metalness: 0.0
            });
            this.MATERIAL_CACHE.set(type, material);
            return material;
        }

        // Load all textures in parallel
        const texturePromises = [
            this.loadTexture(preset.albedoPath),
            preset.normalPath ? this.loadTexture(preset.normalPath) : Promise.resolve(null),
            preset.roughnessPath ? this.loadTexture(preset.roughnessPath) : Promise.resolve(null)
        ];

        const [albedoTexture, normalTexture, roughnessTexture] = await Promise.all(texturePromises);

        // Configure textures
        const configureTexture = (texture: THREE.Texture | null) => {
            if (!texture) return;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(6, 6);
        };

        if (albedoTexture) {
            configureTexture(albedoTexture);
            albedoTexture.colorSpace = THREE.SRGBColorSpace;
        }
        
        configureTexture(normalTexture);
        configureTexture(roughnessTexture);

        const material = new THREE.MeshStandardMaterial({
            map: albedoTexture,
            normalMap: normalTexture,
            roughnessMap: roughnessTexture,
            roughness: 1.0, // Use map fully
            metalness: 0.0, // Wood is not metallic
        });

        this.MATERIAL_CACHE.set(type, material);
        return material;
    }

    private static loadTexture(path: string): Promise<THREE.Texture | null> {
        return new Promise((resolve) => {
            this.textureLoader.load(
                path,
                (texture) => resolve(texture),
                undefined,
                (error) => {
                    console.error('Failed to load texture:', path, error);
                    resolve(null);
                }
            );
        });
    }

    public static clearCache(): void {
        this.MATERIAL_CACHE.forEach((material) => {
            material.map?.dispose();
            material.normalMap?.dispose();
            material.roughnessMap?.dispose();
            material.dispose();
        });
        this.MATERIAL_CACHE.clear();
    }
}
