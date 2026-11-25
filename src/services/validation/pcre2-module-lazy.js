//PWA builds fetch the engine on demand: the dynamic import keeps the WASM
//(embedded in the Emscripten module) out of the main bundle, in its own chunk
export async function loadPcre2Module () {
    return import('pcre2-wasm');
}
