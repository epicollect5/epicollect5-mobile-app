import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

const resolveRoot = fileURLToPath(new URL('./src', import.meta.url));
const testsRoot = fileURLToPath(new URL('./tests', import.meta.url));
//the PWA reports to Rollbar with the package version as code_version
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isPWA = (process.env.VITE_MODE || env.VITE_MODE) === 'PWA';
    const isDebug = (process.env.VITE_DEBUG ?? env.VITE_DEBUG) === '1';
    const isBuild = command === 'build';
    const isTest = !!process.env.VITEST;
    //pwa:browser dev: the Laravel page (port 80) loads the bundle from this
    //server, so root-relative asset URLs (/src/...) in injected CSS and JS
    //image imports would resolve against the page origin and 404. pwa-dev.js
    //sets VITE_DEV_ORIGIN to the dev server URL, and Vite prefixes generated
    //dev asset URLs with it (absolute http://localhost:PORT/...), so they
    //load cross-origin from here instead
    const devOrigin = (process.env.VITE_DEV_ORIGIN || '').replace(/\/+$/, '');

    return {
        //dev server: the project.pwa blade on the laravel origin loads the dev
        //bundle and the vite client from here while the hot file exists (see
        //scripts/pwa-dev.js), so module requests are cross-origin and need cors
        server: {
            cors: true,
            ...(devOrigin ? { origin: devOrigin } : {})
        },
        //PWA: relative base - the preload helper builds dependency URLs from
        //this base, and a root-absolute '/' 404s on any subpath deployment
        //(the local userdir server, production /pwa/). The hashed chunk
        //imports are module-relative either way. Native: served at the
        //webview root, '/' as always
        base: isPWA ? './' : '/',
        define: {
            'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION)
        },
        build: {
            target: 'es2020',
            //separate outputs per target: each build only wipes its own
            //directory, so a native and a PWA build coexist side by side
            outDir: isPWA ? 'dist/pwa' : 'dist/native',
            emptyOutDir: true,
            //PWA: emit .vite/manifest.json so the server shell can reference the
            //hashed entry; native has no manifest consumer
            manifest: isPWA,
            //maps are consumed by the rollbar uploads (native and PWA) and by
            //DevTools on debug builds; they are never deployed (deploy-pwa.js
            //excludes *.map)
            sourcemap: true,
            minify: isDebug ? false : 'esbuild',
            cssMinify: isDebug ? false : 'esbuild',
            esbuild: {
                // strip noisy logs in prod but keep console.error for observability
                pure: isDebug ? [] : ['console.log', 'console.warn']
            },
            rollupOptions: {
                output: {
                    //PWA: content-hashed names, cache busting without ?v= (relative
                    //chunk imports carry the hashes; the blade reads the manifest).
                    //Native: stable names as before - its web bundle ships inside
                    //the app package and is replaced atomically with it
                    entryFileNames: isPWA ? 'assets/[name]-[hash].js' : 'assets/[name].js',
                    chunkFileNames: isPWA ? 'assets/[name]-[hash].js' : 'assets/[name].js',
                    assetFileNames: isPWA ? 'assets/[name]-[hash][extname]' : 'assets/[name][extname]',
                    //PWA: Rolldown's native codeSplitting groups - one named chunk
                    //per vendor family plus the app chunk, each carrying a content
                    //hash so the server shell cache-busts through the manifest.
                    //manualChunks is a compatibility shim that Rolldown migrates to
                    //a single name-only group, which silently folds @vue/vue-router
                    //and most of @ionic/core into app (no vendor-vue chunk at all):
                    //an explicit test per group is what actually produces named
                    //chunks. Native keeps manualChunks as before - stable unhashed
                    //names, its web bundle ships inside the app package and is
                    //replaced atomically with it
                    ...(isPWA ? {
                        codeSplitting: {
                            groups: [
                                //pcre2-wasm embeds the WASM engine and is imported
                                //dynamically (via pcre2-module-lazy), so it stays in
                                //its own chunk fetched on first regex evaluation; a
                                //project without regex questions never downloads it
                                { name: 'vendor-pcre2', test: /pcre2-wasm/, priority: 50 },
                                //every Capacitor-family package (scoped @capacitor/*,
                                //@capgo/* such as camera-preview, @capawesome* plugins
                                //such as the datetime picker, and unscoped capacitor-*
                                //plugins such as capacitor-native-settings) into
                                //vendor-capacitor to avoid cross-chunk cycles with
                                //vendor-common
                                { name: 'vendor-capacitor', test: /[\\/]node_modules[\\/](@capacitor|@capgo|@capawesome|capacitor)/, priority: 40 },
                                { name: 'vendor-vue', test: /[\\/]node_modules[\\/]@vue[\\/]/, priority: 30 },
                                //Ionic JS goes to vendor-ionic, but NOT the global
                                //stylesheets under @ionic/vue/css (the lookahead):
                                //those must stay in app.css, see the app group
                                { name: 'vendor-ionic', test: /[\\/]node_modules[\\/]@ionic[\\/](?!vue[\\/]css[\\/])/, priority: 30 },
                                //vite's preload helper is a virtual module imported
                                //by any chunk with dynamic imports; ModalPhoto (and
                                //the swiper it pulls in) loads on demand - both join
                                //vendor-common so neither drags a cycle out of it.
                                //@ionic/vue/css is excluded so it falls through to the
                                //app group below
                                { name: 'vendor-common', test: /([\\/]node_modules[\\/](?!@ionic[\\/]vue[\\/]css[\\/])|vite[\\/]preload-helper|ModalPhoto\.vue)/, priority: 10 },
                                //Ionic's global stylesheets and the app code share app.css:
                                //theme/variables.css sets the brand :root override after
                                //Ionic's own defaults in the same file, so the brand purple
                                //wins. Split into vendor-ionic they load on their own
                                //<link> and the server shell emits stylesheets in manifest
                                //order (app.css before vendor-ionic.css), letting Ionic's
                                //default --ion-color-primary (#0054e9) override the brand.
                                //ModalPhoto.vue is kept out (vendor-common above): it is
                                //async loaded and must not land in the eager app chunk
                                { name: 'app', test: /([\\/]src[\\/]|node_modules[\\/]@ionic[\\/]vue[\\/]css[\\/])/, priority: 1 }
                            ]
                        }
                    } : {
                        manualChunks(id) {
                            if (id.includes('node_modules')) {
                            //group every Capacitor-family package (scoped @capacitor/*,
                                //@capgo/* such as camera-preview, and unscoped capacitor-* plugins
                                //such as capacitor-native-settings) into vendor-capacitor to avoid
                                //cross-chunk cycles with vendor-common
                                if (id.includes('@capgo')) {return 'vendor-capacitor';}
                                if (id.includes('capacitor')) {return 'vendor-capacitor';}
                                if (id.includes('@vue')) {return 'vendor-vue';}
                                if (id.includes('@ionic')) {return 'vendor-ionic';}
                                return 'vendor-common';
                            }
                            //vite's preload helper is a virtual module (\0vite/preload-helper.js)
                            //imported by any chunk with dynamic imports; Rollup otherwise parks it on
                            //whichever chunk imports it first, dragging vendor-common and
                            //vendor-capacitor into a cycle with vendor-ionic
                            if (id.includes('vite/preload-helper')) {return 'vendor-common';}
                            //ModalPhoto (and the swiper library it pulls in) loads on
                            //demand: routing it to vendor-common keeps it in the same
                            //dynamic chunk as the other lazy vendor code, instead of a
                            //pointless ~2 kB chunk of its own
                            if (id.includes('ModalPhoto.vue')) {return 'vendor-common';}
                            //single app chunk as before
                            if (id.includes('/src/')) {return 'app';}
                        }
                    })
                }
            }
        },
        resolve: {
            extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue'],
            alias: {
                // Specific PWA stubs must come BEFORE the '@' alias, otherwise
                // '@' matches first and shadows them (Vite matches aliases in order)
                ...(isPWA ? {
                    // the fake entries harness (add-fake-entries, fake-answer-service
                    // and the an-array-of-*-words word lists) is native-only: stub
                    // the entry point so none of it reaches the PWA bundle
                    '@/use/entries/add-fake-entries': fileURLToPath(new URL('./src/__mocks__/empty-fake-entries.js', import.meta.url)),
                    '@/services/entry/fake-answer-service': fileURLToPath(new URL('./src/__mocks__/empty-fake-service.js', import.meta.url)),
                    //the barcode scanner plugin drags in the 1.2 MB html5-qrcode
                    //web build: PWA barcode questions are text inputs, users type
                    '@capacitor/barcode-scanner': fileURLToPath(new URL('./src/__mocks__/empty-barcode-scanner.js', import.meta.url)),
                    'an-array-of-english-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url)),
                    'an-array-of-german-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url)),
                    'an-array-of-spanish-words': fileURLToPath(new URL('./src/__mocks__/empty-array.js', import.meta.url)),
                    // the WASM engine is fetched on demand, so the Emscripten module
                    // stays out of the PWA main bundle
                    '@/services/validation/pcre2-module': fileURLToPath(new URL('./src/services/validation/pcre2-module-lazy.js', import.meta.url))
                } : {
                    // native builds bundle the engine statically, inside the app
                    // bundle, exactly as before the PWA split
                    '@/services/validation/pcre2-module': fileURLToPath(new URL('./src/services/validation/pcre2-module-static.js', import.meta.url))
                }),
                // In tests, expose the shared test helpers under '@/helpers/...'
                // so specs import them the same way they import source modules.
                ...(isTest ? { '@/helpers': testsRoot + '/helpers' } : {}),
                '@': resolveRoot
            }
        },
        plugins: [
            vue(isTest ? {
                template: {
                    compilerOptions: {
                        //tests compile templates exactly like the app build (the
                        //app sets no isCustomElement at all): every hyphenated tag
                        //resolves as a component, so a spec must register or stub
                        //the global ones (base-layout etc.) it does not want real.
                        //Only ion-* stays a raw custom element, because IonicVue
                        //is not installed in jsdom. A new hyphenated component
                        //therefore needs no entry here; a spec forgetting to
                        //register one fails loudly with "Failed to resolve
                        //component" via tests/setup-vue-warns.js. Do NOT widen
                        //this predicate to all hyphenated tags: unresolved tags
                        //would render as silent raw elements (content skipped,
                        //invisible to findComponent), which is what forced the
                        //per-component exception whitelist this replaces
                        isCustomElement: (tag) => tag.startsWith('ion-')
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
            setupFiles: ['tests/setup-vue-warns.js'],
            coverage: {
                provider: 'v8'
            }
        }
    };
});
