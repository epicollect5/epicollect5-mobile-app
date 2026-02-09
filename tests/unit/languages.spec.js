import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {utilsService} from '@/services/utilities/utils-service';

// 1. Define paths to your assets
const STATUS_CODES_DIR = path.resolve(__dirname, '../../public/assets/ec5-status-codes');
// Adjust this path to where your labels/strings are kept

const SUPPORTED_LANGUAGES = PARAMETERS.SUPPORTED_LANGUAGES;
const DEFAULT_LANG = PARAMETERS.DEFAULT_LANGUAGE;

// Helper to read and parse JSON
const getJsonFile = (dir, lang) => {
    const filePath = path.join(dir, `${lang}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

describe('I18N Build Validation', () => {

    describe('Status Codes JSON integrity', () => {
        const masterFile = getJsonFile(STATUS_CODES_DIR, DEFAULT_LANG);
        const masterKeys = Object.keys(masterFile);

        SUPPORTED_LANGUAGES.forEach((lang) => {
            it(`should match keys between ${DEFAULT_LANG} and ${lang}`, () => {
                const targetFile = getJsonFile(STATUS_CODES_DIR, lang);

                // Check for missing keys in the target language
                const missingInTarget = masterKeys.filter((key) => !(key in targetFile));
                // Check if target has keys that English doesn't
                const extraInTarget = Object.keys(targetFile).filter((key) => !(key in masterFile));

                if (missingInTarget.length > 0) {
                    console.error(`❌ ${lang}.json is missing keys:`, missingInTarget);
                }
                if (extraInTarget.length > 0) {
                    console.error(`⚠️ ${lang}.json has extra keys not in ${DEFAULT_LANG}:`, extraInTarget);
                }

                expect(missingInTarget).toEqual([]);
                expect(extraInTarget).toEqual([]);
            });
        });
    });

    describe('Labels (STRINGS.js) integrity', () => {
        // The master list of keys from the English labels
        const masterLabels = STRINGS[DEFAULT_LANG].labels;
        const masterKeys = Object.keys(masterLabels);

        SUPPORTED_LANGUAGES.forEach((lang) => {
            it(`should match all keys between [${DEFAULT_LANG}] and [${lang}]`, () => {
                const targetLabels = STRINGS[lang].labels;

                // 1. Check if the language actually exists in the object
                expect(targetLabels, `Language "${lang}" is missing from STRINGS object!`).toBeDefined();

                // 2. Use your improved hasSameKeys logic
                // This will trigger the console.warn logs we wrote earlier
                utilsService.hasSameKeys(masterLabels, targetLabels);

                // 3. Detailed Vitest assertion for the report
                const targetKeys = Object.keys(targetLabels);

                // This ensures that if it fails, Vitest shows a clean diff of the missing strings
                expect(targetKeys.sort()).toEqual(masterKeys.sort());
            });
        });
    });
});
