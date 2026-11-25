import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

//pins the PWA chunk routing that keeps vendor-pcre2 lazy: Rolldown parks
//unmatched virtual modules (vite/preload-helper, oxc runtime helpers) in
//the highest-priority group that reaches them, so without an explicit
//vendor-common branch the entry chunk statically imports the whole WASM
//engine on every load. Parses the codeSplitting groups out of the config
//source (the config module itself is not importable under vitest) and
//simulates Rolldown's max-priority-wins matching
const configSource = fs.readFileSync(
    path.resolve(import.meta.dirname, '../../vite.config.js'),
    'utf8'
);
//the block runs from "groups: [" up to the matching "]", which closes just
//before the "} : {" that starts the native manualChunks branch
const groupsStart = configSource.indexOf('groups: [') + 'groups: ['.length;
const groupsEnd = configSource.indexOf('} : {', groupsStart);
const groupsBlock = configSource.slice(groupsStart, groupsEnd);
//regex literals in the source contain escaped slashes and character classes,
//so match the full test:/.../, priority: N pair per line instead of trying
//to parse nested regex syntax; eval is safe here since the source is our own config
const groupPattern = /\{\s*name:\s*'([^']+)',\s*test:\s*(\/.*\/),\s*priority:\s*(\d+)\s*\}/g;
const groups = [...groupsBlock.matchAll(groupPattern)].map((match) => ({
    matchName: match[1],
    test: eval(match[2]),
    priority: Number(match[3])
}));

const match = (id) => {
    const matching = groups.filter((group) => group.test.test(id));
    matching.sort((a, b) => b.priority - a.priority);

    return matching[0];
};

describe('pwa chunk routing', () => {
    it('routes the vite preload helper to vendor-common while the engine stays in vendor-pcre2', () => {
        const helper = match(`${String.fromCharCode(0)}vite/preload-helper.js`);
        const engine = match('/repo/node_modules/pcre2-wasm/dist/pcre2.js');

        //the helper is only reachable via vendor-common's virtual-module
        //branch: parked nowhere else, the entry chunk never statically
        //imports the WASM engine
        expect(helper.matchName).toBe('vendor-common');
        //the engine path also matches vendor-common's node_modules branch,
        //so vendor-pcre2 must out-prioritise it to stay lazy
        expect(engine.matchName).toBe('vendor-pcre2');
        expect(engine.priority).toBeGreaterThan(helper.priority);
    });

    it('routes shared oxc runtime helpers to vendor-common while the engine stays in vendor-pcre2', () => {
        const helper = match(`${String.fromCharCode(0)}@oxc-project+runtime/helpers/esm/defineProperty.js`);
        const engine = match('/repo/node_modules/pcre2-wasm/dist/pcre2.js');

        expect(helper.matchName).toBe('vendor-common');
        expect(engine.matchName).toBe('vendor-pcre2');
        expect(engine.priority).toBeGreaterThan(helper.priority);
    });

    it('leaves ModalPhoto and swiper unmatched so they form their own async chunk', () => {
        expect(match('/repo/src/components/modals/ModalPhoto.vue')).toBeUndefined();
        expect(match('/repo/node_modules/swiper/swiper.mjs')).toBeUndefined();
    });

    it('keeps the regular vendor families routed as before', () => {
        expect(match('/repo/node_modules/@capacitor/core/index.js').matchName).toBe('vendor-capacitor');
        expect(match('/repo/node_modules/@vue/runtime-core/index.js').matchName).toBe('vendor-vue');
        expect(match('/repo/node_modules/lodash/lodash.js').matchName).toBe('vendor-common');
        expect(match('/repo/src/main.js').matchName).toBe('app');
    });
});
