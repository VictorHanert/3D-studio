import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.ts'],
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    build: {
        chunkSizeWarningLimit: 1000, // Suppress warning for Three.js bundle
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    inertia: ['@inertiajs/vue3'],
                }
            }
        }
    },
    server: {
        host: '3d-studio.test',
        port: 5173,
        strictPort: true,
        hmr: {
            host: '3d-studio.test',
            protocol: 'wss',
            port: 5173,
            clientPort: 5173,
            timeout: 60000, // Increase HMR timeout to 60 seconds
        },
    },
    optimizeDeps: {
        include: ['@lineiconshq/vue-lineicons', '@lineiconshq/free-icons'],
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
        },
    },
});
