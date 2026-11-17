// Fails unless the Android web bundle came from `npm run native:prod`.
// A debug build (VITE_DEBUG=1, e.g. `npm run native:debug` or `android:open`) ships
// dev helpers and a non-production server URL, and must never reach a release APK.
//
// Usage:
//   node scripts/check-release-bundle.js [path]
//     path = a signed APK (checks what is actually published), or
//            a copied assets directory (default, checks the build output).

import {execFileSync} from 'node:child_process';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const ASSETS_PREFIX = 'assets/public/assets/';
const isBundleFile = (name) => name.endsWith('.js') && !name.endsWith('.map');

const readFromApk = (apk) => {
  const names = execFileSync('unzip', ['-Z1', apk], {encoding: 'utf8'})
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name.startsWith(ASSETS_PREFIX))
    .map((name) => name.slice(ASSETS_PREFIX.length))
    .filter((name) => !name.includes('/') && isBundleFile(name));

  if (!names.length) {
    throw new Error(`no web bundle under ${ASSETS_PREFIX} in the APK`);
  }

  return execFileSync('unzip', ['-p', apk, ...names.map((name) => ASSETS_PREFIX + name)], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
};

const readFromDir = (dir) => {
  return readdirSync(dir)
    .filter(isBundleFile)
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
};

const target = process.argv[2] ?? 'android/app/src/main/assets/public/assets';

let source;
try {
  source = target.endsWith('.apk') ? readFromApk(target) : readFromDir(target);
} catch (error) {
  console.error(`check-release-bundle: cannot read the web bundle from ${target}`);
  console.error(`  ${error.message}`);
  process.exit(1);
}

const problems = [];

if (/DEBUG:"1"/.test(source)) {
  problems.push('debug build detected (DEBUG:"1")');
}

if (!source.includes('DEBUG:""')) {
  problems.push('VITE_DEBUG is not cleared (expected DEBUG:"")');
}

if (/BYPASS_UNIQUENESS:"1"/.test(source)) {
  problems.push('uniqueness bypass enabled in release build');
}

if (!source.includes('BYPASS_UNIQUENESS:""')) {
  problems.push('VITE_BYPASS_UNIQUENESS is not cleared');
}

if (problems.length) {
  console.error('');
  console.error('This build is not production-ready.');
  console.error('The packaged web bundle was not built with `npm run native:prod` (VITE_DEBUG must be cleared).');
  console.error(`Target: ${target}`);
  console.error('');
  console.error('Problems:');
  problems.forEach((problem) => {
    console.error(`  - ${problem}`);
  });
  console.error('');
  console.error('Fix: run `npm run native:prod` (and copy/sync assets), then rebuild the release.');
  process.exit(1);
}

console.log(`check-release-bundle: OK (native:prod build, ${target})`);
