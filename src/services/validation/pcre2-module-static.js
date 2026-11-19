//native builds bundle the engine statically: the whole module ships inside the
//app bundle as before, so no runtime fetch is needed
import * as pcre2Module from 'pcre2-wasm';

export async function loadPcre2Module () {
    return pcre2Module;
}
