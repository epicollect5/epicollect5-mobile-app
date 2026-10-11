import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(rootDir, filePath), 'utf8'));
const readText = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');

// Keep in sync with docs/ARCHITECTURE.md ("Native Night Mode (Theme)").
// iOS does not auto-discover plugins: `npx cap copy ios` regenerates
// packageClassList in the copied capacitor.config.json from npm-installed
// plugins only, silently dropping local classes like NightModePlugin. The
// ensure script (wired into the ios npm scripts) puts the entry back, and
// these assertions catch a lost registration in the normal test gate instead
// of on a device.

describe('native NightMode plugin registration', () => {
    it('is listed in the copied capacitor.config.json packageClassList', () => {
        const config = readJson('ios/App/App/capacitor.config.json');

        expect(config.packageClassList).toContain('NightModePlugin');
    });

    it('is re-inserted after every cap copy by the ensure-script wiring', () => {
        const pkg = readJson('package.json');
        for (const script of ['ios:build', 'ios:open', 'native:debug', 'native:prod', 'native:copy', 'prod']) {
            //ios scripts copy ios only, shared scripts copy all platforms:
            //both regenerate the ios packageClassList
            const copyIndex = pkg.scripts[script].indexOf('npx cap copy');
            const ensureIndex = pkg.scripts[script].indexOf('scripts/ensure-ios-nightmode-plugin.js');

            expect(copyIndex).toBeGreaterThan(-1);
            //runs after the copy that wipes the list
            expect(ensureIndex).toBeGreaterThan(copyIndex);
        }
    });

    it('is wired into the committed Xcode project', () => {
        const pbxproj = readText('ios/App/App.xcodeproj/project.pbxproj');

        expect(pbxproj).toContain('/* NightModePlugin.swift */ = {isa = PBXFileReference');
        expect(pbxproj).toContain('NightModePlugin.swift in Sources');
    });

    //Both platforms must expose the same JS contract consumed by theme-service.js
    it('ships matching plugin sources on both platforms', () => {
        const swift = readText('ios/App/App/NightModePlugin.swift');
        const java = readText('android/app/src/main/java/uk/ac/imperial/epicollect/five/NightModePlugin.java');

        expect(swift).toContain('jsName = "NightMode"');
        expect(swift).toContain('setNightMode');
        expect(java).toContain('@CapacitorPlugin(name = "NightMode")');
        expect(java).toContain('setNightMode');
    });
});
