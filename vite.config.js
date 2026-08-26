import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

const resolveRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isPWA = (process.env.VITE_MODE || env.VITE_MODE) === 'PWA';
    const isDebug = (process.env.VITE_DEBUG ?? env.VITE_DEBUG) === '1';
    const isBuild = command === 'build';
    const isTest = !!process.env.VITEST;

    return {
        base: '/',
        build: {
            target: 'es2020',
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: true,
            minify: isDebug ? false : 'esbuild',
            esbuild: {
                // strip noisy logs in prod but keep console.error for observability
                pure: isDebug ? [] : ['console.log', 'console.warn']
            },
            rollupOptions: {
                output: {
                    // filenameHashing:false -> stable names
                    entryFileNames: 'assets/[name].js',
                    chunkFileNames: 'assets/[name].js',
                    assetFileNames: 'assets/[name][extname]',
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('@capacitor')) return 'vendor-capacitor';
                            if (id.includes('@vue')) return 'vendor-vue';
                            if (id.includes('@ionic')) return 'vendor-ionic';
                            return 'vendor-common';
                        }
                        if (id.includes('/src/')) return 'app';
                    }
                }
            }
        },
        resolve: {
            extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue'],
            alias: {
                // Specific PWA stubs must come BEFORE the '@' alias, otherwise
                // '@' matches first and shadows them (Vite matches aliases in order)
                ...(isPWA ? {
                    '@/services/entry/fake-answer-service': fileURLToPath(new URL('./src/__mocks__/empty-fake-service.js', import.meta.url)),
                    'an-array-of-english-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url)),
                    'an-array-of-german-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url)),
                    'an-array-of-spanish-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url))
                } : {}),
                '@': resolveRoot
            }
        },
        plugins: [
            vue(isTest ? {
                template: {
                    compilerOptions: {
                        // tests render ion-* and other hyphenated tags as
                        // plain custom elements (no IonicVue context needed),
                        // matching the previous vitest.config behaviour
                        isCustomElement: (tag) => tag.includes('-') && tag !== 'base-layout'
                    }
                }
            } : {}),
            viteCommonjs()
        ],
        css: {
            preprocessorOptions: {
                scss: {
                    silenceDeprecations: ['legacy-js-api']
                }
            }
        },
        test: {
            globals: true,
            environment: 'jsdom', // to make "import" work
            reporters: 'verbose',
            silent: true,
            coverage: {
                provider: 'v8'
            }
        }
    };
});
