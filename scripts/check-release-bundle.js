// Fails unless the packaged Android web bundle came from `npm run native:prod`.
// A debug build (VITE_DEBUG=1) ships dev helpers and must never reach a release APK.

import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.argv[2] ?? 'android/app/src/main/assets/public/assets';

let files;
try {
  files = readdirSync(dir).filter((file) => file.endsWith('.js') && !file.endsWith('.map'));
} catch {
  console.error(`check-release-bundle: cannot read ${dir} (run "npm run native:prod" first)`);
  process.exit(1);
}

const source = files.map((file) => readFileSync(join(dir, file), 'utf8')).join('\n');

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
  console.error('check-release-bundle: FAILED - not a native:prod build');
  problems.forEach((problem) => {
    console.error(`  - ${problem}`);
  });
  console.error('');
  console.error('Build the release bundle with: npm run native:prod');
  process.exit(1);
}

console.log('check-release-bundle: OK (native:prod build)');
