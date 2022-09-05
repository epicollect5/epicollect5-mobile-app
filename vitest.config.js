import path from 'path';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',//to make "import" work
        reporters: 'verbose'
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '/src'),
            '@ionic/vue': fileURLToPath(new URL('./node_modules/@ionic/vue/dist/index.esm', import.meta.url))
        }
    },
    clearScreen: true,
    plugins: [vue(), viteCommonjs()]
});