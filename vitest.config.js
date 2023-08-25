import path from 'path';
import { defineConfig } from 'vite';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',//to make "import" work
        reporters: 'verbose',
        silent: true,
        coverage: {
            provider: 'v8'
        }
    },
    // vueCompilerOptions: {
    //     isCustomElement: (tag) => { tag.startsWith('ion-'); }
    // },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '/src')
        }
        //   conditions: process.env.VITEST ? ['node'] : []
    },
    clearScreen: true,
    plugins: [vue({
        template: {
            compilerOptions: {
                // treat all tags with a dash as custom elements
                isCustomElement: (tag) => tag.includes('-')
            }
        }
    }), viteCommonjs()]

});