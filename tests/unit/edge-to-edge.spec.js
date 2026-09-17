import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(rootDir, filePath), 'utf8'));
const readText = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');

const PLUGIN = '@capawesome/capacitor-android-edge-to-edge-support';

// Keep in sync with the pinned version and its rationale in docs/ARCHITECTURE.md
// ("Android Edge-to-Edge"). 8.0.7+ zeroes the WebView bottom margin while the
// fullscreen keyboard is visible, which buries the last GROUP inputs.
const PINNED_VERSION = '8.0.6';

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const capacitorConfig = readJson('capacitor.config.json');

describe('android edge-to-edge plugin', () => {
    it('is pinned to an exact version', () => {
        expect(packageJson.dependencies[PLUGIN]).toBe(PINNED_VERSION);
    });

    it('resolves the pinned version in the lockfile', () => {
        expect(packageLock.packages[''].dependencies[PLUGIN]).toBe(PINNED_VERSION);
        expect(packageLock.packages[`node_modules/${PLUGIN}`].version).toBe(PINNED_VERSION);
    });

    it('keeps Capacitor core from injecting its own insets', () => {
        expect(capacitorConfig.plugins.SystemBars.insetsHandling).toBe('disable');
    });

    // The gradle project id is derived from the package scope, so a Capacitor
    // sync change or an upstream rename surfaces here rather than in the build.
    it('is wired into the committed Android project', () => {
        const gradleProject = 'capawesome-capacitor-android-edge-to-edge-support';

        expect(readText('android/capacitor.settings.gradle')).toContain(gradleProject);
        expect(readText('android/app/capacitor.build.gradle')).toContain(gradleProject);
        expect(readText('android/app/src/main/assets/capacitor.plugins.json')).toContain('EdgeToEdgePlugin');
    });
});
