<script setup lang="js">
import { Head, Link } from '@inertiajs/vue3';
import { Lineicons } from "@lineiconshq/vue-lineicons";
import { AirtableOutlined, Locked1Outlined, User4Outlined } from "@lineiconshq/free-icons";
import { onMounted } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { editor, login, register } from '@/routes';

onMounted(() => {
    init3DPreview();
});

function init3DPreview() {
    const canvas = document.getElementById('3d-preview');
    if (!canvas) return;

    // Simple Three.js setup for sofa model preview
    import('three').then(async ({ Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, Vector3, Box3, BoxGeometry, MeshLambertMaterial, Mesh }) => {
        import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
            const scene = new Scene();
            const camera = new PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
            const renderer = new WebGLRenderer({ canvas, antialias: true });

            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            renderer.setClearColor(0xf8f9fa);

            // Lighting
            const ambientLight = new AmbientLight(0x404040, 0.4);
            scene.add(ambientLight);

            const directionalLight = new DirectionalLight(0xffffff, 1.2);
            directionalLight.position.set(5, 5, 5);
            scene.add(directionalLight);

            const directionalLight2 = new DirectionalLight(0xffffff, 0.8);
            directionalLight2.position.set(-5, 5, -5);
            scene.add(directionalLight2);

            // Load GLTF model
            const loader = new GLTFLoader();
            loader.load(
                '/models/CONNECT_MODULAR_SOFA_LEFT_ARMREST_A/DIVINA 106.glb',
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Center and scale the model
                    const box = new Box3().setFromObject(model);
                    const center = box.getCenter(new Vector3());
                    const size = box.getSize(new Vector3());
                    
                    // Center the model
                    model.position.sub(center);
                    
                    // Scale to fit in view
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 2 / maxDim;
                    model.scale.setScalar(scale);
                    
                    scene.add(model);
                    
                    // Position camera to view the model
                    camera.position.set(3, 2, 3);
                    camera.lookAt(0, 0, 0);
                    
                    // Animation loop
                    function animate() {
                        requestAnimationFrame(animate);
                        model.rotation.y += 0.010; // Slow rotation
                        renderer.render(scene, camera);
                    }
                    animate();
                },
                () => {},
                (error) => {
                    console.error('Error loading model:', error);
                    // Fallback to cube if model fails to load
                    const geometry = new BoxGeometry(1, 1, 1);
                    const material = new MeshLambertMaterial({ color: 0x3b82f6 });
                    const cube = new Mesh(geometry, material);
                    scene.add(cube);
                    
                    camera.position.z = 2;
                    
                    function animate() {
                        requestAnimationFrame(animate);
                        cube.rotation.x += 0.01;
                        cube.rotation.y += 0.01;
                        renderer.render(scene, camera);
                    }
                    animate();
                }
            );
        });
    });
}
</script>

<template>
    <Head title="Welcome" />

    <MainLayout>
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
                <div>
                    <h1 class="text-4xl font-semibold text-gray-900 dark:text-white sm:text-5xl">
                        Build your own 3D furniture layouts
                    </h1>
                    <p class="mt-4 text-lg text-gray-600 dark:text-gray-300">
                        Plan, configure, and visualize modular furniture. Start simple and
                        grow into a full 3D editor powered by WebGL.
                    </p>

                    <div class="mt-8 flex flex-wrap gap-3">
                        <Link
                            v-if="$page.props.auth.user"
                            :href="editor()"
                            class="inline-flex items-center gap-2 rounded-md bg-gray-900 dark:bg-gray-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-gray-400"
                        >
                            <Lineicons :icon="AirtableOutlined" :size="24" :stroke-width="2" />
                            Open Editor
                        </Link>
                        <template v-else>
                            <Link
                                :href="login()"
                                class="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <Lineicons :icon="Locked1Outlined" :size="24" :stroke-width="2" />
                                Login
                            </Link>
                            <Link
                                :href="register()"
                                class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                <Lineicons :icon="User4Outlined" :size="24" :stroke-width="2" />
                                Register
                            </Link>
                        </template>
                    </div>
                </div>

                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                    <div class="aspect-video rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                        <canvas
                            id="3d-preview"
                            class="w-full h-full"
                            width="400"
                            height="225"
                        ></canvas>
                    </div>
                    <div class="mt-6 grid gap-4 sm:grid-cols-2">
                        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h3 class="font-medium text-gray-900 dark:text-white">3D system</h3>
                            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                Drag and rotate to create custom layouts.
                            </p>
                        </div>
                        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <h3 class="font-medium text-gray-900 dark:text-white">Modern materials</h3>
                            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                Choose from a variety of fabrics and finishes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </MainLayout>
</template>
