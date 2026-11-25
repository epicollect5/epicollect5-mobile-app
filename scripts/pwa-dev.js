//Starts the vite dev server and drops the Laravel hot file: while
//<VITE_DEPLOY_PWA>/hot exists (containing the dev server URL), the server's
//project.pwa blade loads the dev bundle from this server instead of the built
//assets, so the PWA can be debugged with hot reload on the real Laravel page.
//The page origin stays laravel (same-origin), so session, CSRF and the
///api/internal endpoints behave exactly like production. The file is removed
//when the dev server stops, so the page falls back to the built bundle.
//
//Usage:
//   npm run pwa:browser
//
//which runs this script with VITE_MODE=PWA VITE_DEBUG=1 --port 1234 --host.
//The deploy target is resolved like scripts/deploy-pwa.js does: VITE_DEPLOY_PWA
//(environment, or .env.local as a fallback), and must be an absolute path of an
//existing directory. Note: a pwa:deploy run wipes the target (and the hot file
//with it), so a production deploy always falls back to the built bundle.

import { spawn } from 'node:child_process';
import { existsSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
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

//the dev server port comes from --port (npm script pins 1234); the hot URL
//points at localhost because the laravel page is opened locally
const readPortFromArgs = (args) => {
    const index = args.indexOf('--port');
    const value = index > -1 ? args[index + 1] : undefined;
    const port = Number(value);
    if (!Number.isInteger(port) || port <= 0) {
        console.error('Missing or invalid --port: pass the vite dev server port (e.g. --port 1234)');
        process.exit(1);
    }
    return port;
};

const hotPath = (targetDir) => join(targetDir, 'hot');

const writeHotFile = (hotFilePath, devServerUrl) => {
    writeFileSync(hotFilePath, devServerUrl);
    console.log('Hot file written: ' + hotFilePath + ' -> ' + devServerUrl);
};

const main = () => {
    const args = process.argv.slice(2);
    const port = readPortFromArgs(args);

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

    const hotFilePath = hotPath(targetDir);
    const devServerUrl = 'http://localhost:' + port;

    let hotFileWritten = false;
    const removeHotFile = () => {
        if (!hotFileWritten) {
            return;
        }
        hotFileWritten = false;
        try {
            if (existsSync(hotFilePath)) {
                //best-effort cleanup on every exit path: a stale hot file would
                //make the laravel page load scripts from a dead dev server
                unlinkSync(hotFilePath);
                console.log('Hot file removed: ' + hotFilePath);
            }
        } catch (error) {
            console.error('Could not remove the hot file ' + hotFilePath + ': ' + error.message);
        }
    };

    process.on('exit', removeHotFile);

    const viteBin = join(ROOT, 'node_modules', '.bin', 'vite');
    //stdio inherit keeps the vite CLI output (shortcuts, HMR logs) as-is;
    //SIGINT reaches the whole process group, so the vite child dies on its own
    //while this wrapper removes the hot file on the way out
    //VITE_DEV_ORIGIN makes vite prefix generated dev asset URLs with the dev
    //server URL (see vite.config.js): the Laravel page lives on another
    //origin, so root-relative /src/... URLs in injected CSS/JS would
    //otherwise resolve against the page and 404
    const child = spawn(viteBin, args, {
        stdio: 'inherit',
        env: { ...process.env, VITE_DEV_ORIGIN: devServerUrl + '/' }
    });

    //forward the signal to the vite child: a signal delivered to this wrapper
    //alone (e.g. pkill) would otherwise orphan the dev server holding the port
    process.on('SIGINT', () => {
        child.kill('SIGINT');
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        child.kill('SIGTERM');
        process.exit(0);
    });

    writeHotFile(hotFilePath, devServerUrl + '/');
    hotFileWritten = true;

    child.on('exit', (code) => {
        process.exitCode = code ?? 0;
        process.exit();
    });
};

main();
