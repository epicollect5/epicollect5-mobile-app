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

    it('ships the ensure script that performs the re-insertion', () => {
        //the wiring test above only matches the script path as a string:
        //it still passes if the file is deleted or stops touching the list
        const scriptPath = path.join(rootDir, 'scripts/ensure-ios-nightmode-plugin.js');

        expect(fs.existsSync(scriptPath)).toBe(true);
        const script = fs.readFileSync(scriptPath, 'utf8');
        expect(script).toContain('NightModePlugin');
        expect(script).toContain('packageClassList');
    });

    it('is wired into the committed Xcode project', () => {
        const pbxproj = readText('ios/App/App.xcodeproj/project.pbxproj');

        expect(pbxproj).toContain('/* NightModePlugin.swift */ = {isa = PBXFileReference');
        expect(pbxproj).toContain('NightModePlugin.swift in Sources');
        //the build-file record alone is not enough: its id must be listed
        //in the target's Sources phase, otherwise the plugin never compiles
        const buildFileId = (pbxproj.match(/([0-9A-F]+) \/\* NightModePlugin\.swift in Sources \*\/ = \{isa = PBXBuildFile/) || [])[1];
        expect(buildFileId).toBeTruthy();
        const sourcesSection = pbxproj.slice(
            pbxproj.indexOf('/* Begin PBXSourcesBuildPhase section */'),
            pbxproj.indexOf('/* End PBXSourcesBuildPhase section */')
        );
        expect(sourcesSection).toContain(buildFileId);
    });

    //Both platforms must expose the same JS contract consumed by theme-service.js
    it('ships matching plugin sources on both platforms', () => {
        const swift = readText('ios/App/App/NightModePlugin.swift');
        const java = readText('android/app/src/main/java/uk/ac/imperial/epicollect/five/NightModePlugin.java');

        expect(swift).toContain('jsName = "NightMode"');
        expect(swift).toContain('setNightMode');
        expect(swift).toContain('tintColor');
        expect(java).toContain('@CapacitorPlugin(name = "NightMode")');
        expect(java).toContain('setNightMode');
    });
});
