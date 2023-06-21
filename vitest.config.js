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
            '@': path.resolve(__dirname, '/src')
        }
    },
    clearScreen: true,
    plugins: [vue(), viteCommonjs()]
});