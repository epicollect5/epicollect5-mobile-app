import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(rootDir, filePath), 'utf8'));
const readText = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');
const exists = (filePath) => fs.existsSync(path.join(rootDir, filePath));

// Keep in sync with docs/ARCHITECTURE.md ("Native Night Mode (Theme)").
// The Theme plugin is npm-installed from github-only
// (epicollect5/capacitor-plugin-theme, never the npm registry), so both
// platforms auto-register it on `cap sync`/`copy` — no local sources, no
// ensure script, no manual MainActivity registration. These assertions catch
// a regression to local copies or an unpinned dep in the normal test gate
// instead of on a device.

describe('native Theme plugin registration', () => {
    it('is installed pinned from github, never the npm registry', () => {
        const pkg = readJson('package.json');
        const dep = pkg.dependencies['@epicollect5/capacitor-plugin-theme'];

        expect(dep).toMatch(/^github:epicollect5\/capacitor-plugin-theme#/);
    });

    it('ships no local plugin sources', () => {
        expect(exists('ios/App/App/ThemePlugin.swift')).toBe(false);
        expect(exists('android/app/src/main/java/uk/ac/imperial/epicollect/five/ThemePlugin.java')).toBe(false);
        expect(exists('scripts/ensure-ios-theme-plugin.js')).toBe(false);
    });

    it('needs no manual registration', () => {
        expect(readText('android/app/src/main/java/uk/ac/imperial/epicollect/five/MainActivity.java')).not.toContain('ThemePlugin');
        expect(readText('ios/App/App.xcodeproj/project.pbxproj')).not.toContain('ThemePlugin.swift');
    });

    it('is auto-registered on iOS from the npm package', () => {
        const config = readJson('ios/App/App/capacitor.config.json');

        expect(config.packageClassList).toContain('ThemePlugin');
    });

    it('is auto-registered on Android from the npm package', () => {
        expect(readText('android/capacitor.settings.gradle')).toContain('node_modules/@epicollect5/capacitor-plugin-theme/android');
        const plugins = readJson('android/app/src/main/assets/capacitor.plugins.json');

        expect(plugins.some((plugin) => plugin.pkg === '@epicollect5/capacitor-plugin-theme')).toBe(true);
    });

    //Both platforms must expose the same JS contract consumed by theme-service.js
    it('ships matching plugin sources on both platforms', () => {
        const swift = readText('node_modules/@epicollect5/capacitor-plugin-theme/ios/Plugin/ThemePlugin.swift');
        const java = readText('node_modules/@epicollect5/capacitor-plugin-theme/android/src/main/java/uk/ac/imperial/epicollect/plugin/theme/ThemePlugin.java');

        expect(swift).toContain('jsName = "Theme"');
        expect(swift).toContain('setTheme');
        expect(swift).toContain('tintColor');
        //dark surfaces need the lighter same-hue purple (#673C90 washes out)
        expect(swift).toContain('UIColor(red: 179/255, green: 157/255, blue: 219/255, alpha: 1)');
        expect(java).toContain('@CapacitorPlugin(name = "Theme")');
        expect(java).toContain('setTheme');
    });
});
