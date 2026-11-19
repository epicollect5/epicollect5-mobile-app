// Copies the built PWA (dist/) into the server repo location defined by
// VITE_DEPLOY_PWA (environment, or .env.local as a fallback). The target's
// contents are wiped before the copy, so files from a previous deploy (old
// chunks, stale sourcemaps from debug builds) cannot linger next to the new
// ones: chunk names are hashed per build, so an overlay copy would leave
// debris behind.
//
// Usage:
//   npm run pwa:deploy
//
// which runs the prod build first, then this script. Fails loudly when the
// target is missing, relative or not a directory: deploying to a wrong or
// half-configured location must stop here, not surface later as a broken app.

import { cpSync, existsSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const cleanEnvValue = (value) => String(value ?? '').trim().replace(/^['"]|['"]$/g, '');

const loadDeployTarget = (env = process.env) => {
    const fromEnv = cleanEnvValue(env.VITE_DEPLOY_PWA);
    if (fromEnv) {
        return fromEnv;
    }
    return cleanEnvValue(loadEnv('', ROOT, '').VITE_DEPLOY_PWA);
};

//true when the two paths are equal or either one is an ancestor of the other:
//the deploy wipes the target before copying, so a target overlapping dist
//(same dir, its parent or one of its children) would destroy the build or
//the whole repo before the copy has a chance to fail
export const hasDeployPathOverlap = (distDir, targetDir) => {
    const distResolved = resolve(distDir);
    const targetResolved = resolve(targetDir);
    const distToTarget = relative(distResolved, targetResolved);
    const targetToDist = relative(targetResolved, distResolved);
    const isInside = (rel) => rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    return isInside(distToTarget) || isInside(targetToDist);
};

//What the PWA never loads, so it is not shipped to the server:
//- the Laravel controller serves the HTML shell itself, and robots.txt with it
//- sourcemaps are built for the Rollbar upload and must stay private
//- the PWA pins rootStore.language to 'en' (boot-pwa), so only en.json of the
//  status-codes set is ever requested (native builds keep them all in public/)
const STATUS_CODES_DIR = 'assets/ec5-status-codes/';

const isExcludedFromDeploy = (relativePath) => {
    if (relativePath === 'index.html' || relativePath === 'robots.txt') {
        return true;
    }
    if (relativePath.endsWith('.map')) {
        return true;
    }
    if (relativePath.startsWith(STATUS_CODES_DIR)) {
        return relativePath !== STATUS_CODES_DIR + 'en.json';
    }
    return false;
};

const deploy = (distDir, targetDir) => {
    //wipe the target's contents, keeping the directory itself
    for (const entry of readdirSync(targetDir)) {
        rmSync(join(targetDir, entry), { recursive: true, force: true });
    }
    cpSync(distDir, targetDir, {
        recursive: true,
        filter: (srcPath) => {
            const relativePath = relative(distDir, srcPath);
            return relativePath === '' || !isExcludedFromDeploy(relativePath);
        }
    });
};

const main = () => {
    const targetDir = loadDeployTarget();

    if (!targetDir) {
        console.error('VITE_DEPLOY_PWA is not set: add it to .env.local (absolute path of the server location)');
        process.exit(1);
    }
    if (!isAbsolute(targetDir)) {
        console.error('VITE_DEPLOY_PWA must be an absolute path, got: ' + targetDir);
        process.exit(1);
    }
    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
        console.error('VITE_DEPLOY_PWA does not exist or is not a directory: ' + targetDir);
        process.exit(1);
    }

    const distDir = join(ROOT, 'dist');
    if (!existsSync(join(distDir, 'index.html'))) {
        console.error('No build found in dist/: run npm run pwa:prod first');
        process.exit(1);
    }

    //refuse before touching anything: a misconfigured target wiping the build
    //or the repo is unrecoverable, while a failed copy is simply re-run.
    //Compare real paths (both exist by now): the overlap check is textual, so
    //a symlinked target would pass it and the wipe below would follow the
    //link into the build or the repo
    if (hasDeployPathOverlap(realpathSync(distDir), realpathSync(targetDir))) {
        console.error('VITE_DEPLOY_PWA overlaps the build directory: ' + targetDir);
        process.exit(1);
    }

    deploy(distDir, targetDir);
    console.log('PWA deployed to ' + targetDir);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main();
}
