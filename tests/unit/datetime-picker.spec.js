import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(rootDir, filePath), 'utf8'));
const readText = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');

const PLUGIN = '@capawesome-team/capacitor-datetime-picker';

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');

describe('capacitor datetime-picker plugin', () => {
    it('is added with a caret range on v8', () => {
        expect(packageJson.dependencies[PLUGIN]).toMatch(/^\^8/);
    });

    it('resolves v8 in the lockfile', () => {
        expect(packageLock.packages[''].dependencies[PLUGIN]).toMatch(/^\^8/);
        expect(packageLock.packages[`node_modules/${PLUGIN}`].version).toMatch(/^8\./);
    });

    it('is wired into the committed Android project', () => {
        const gradleProject = 'capawesome-team-capacitor-datetime-picker';

        expect(readText('android/capacitor.settings.gradle')).toContain(gradleProject);
        expect(readText('android/app/capacitor.build.gradle')).toContain(gradleProject);
        expect(readText('android/app/src/main/assets/capacitor.plugins.json')).toContain('DatetimePickerPlugin');
    });

    it('is wired into the committed iOS project', () => {
        expect(readText('ios/App/Podfile')).toContain('CapawesomeTeamCapacitorDatetimePicker');
        expect(readText('ios/App/App/capacitor.config.json')).toContain('DatetimePickerPlugin');
    });

    it('keeps the brand accent on the native Android sheets', () => {
        //the plugin hardcodes stock framework dialog themes, so the app
        //redefines the same style names (app wins at resource-merge time);
        //accent must stay the brand primary used by legacy pickers.
        const styles = readText('android/app/src/main/res/values/styles.xml');
        expect(styles).toContain('name="MaterialLightTheme"');
        expect(styles).toContain('name="MaterialDarkTheme"');
        expect(styles).toContain('#673C90');
        //dark surfaces need the lighter same-hue purple (#673C90 washes out)
        const nightStyles = readText('android/app/src/main/res/values-night/styles.xml');
        expect(nightStyles).toContain('name="MaterialDarkTheme"');
        expect(nightStyles).toContain('#B39DDB');
    });
});
