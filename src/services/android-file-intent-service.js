/**
 * Android File Intent Handler Service
 * Handles file intents from Android file manager when JSON files are opened
 */

import {Filesystem} from '@capacitor/filesystem';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';

export const androidFileIntentService = {
    /**
     * Check if the intent is a JSON file intent from Android file manager
     * @param {string} url - The URL from the intent
     * @param {string} platform - The device platform (PARAMETERS.ANDROID, etc.)
     * @returns {boolean}
     */
    isJsonFileIntent(url, platform) {
        if (platform !== PARAMETERS.ANDROID || !url) {
            return false;
        }
        // Skip http/https URLs - they should be handled separately
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return false;
        }
        // Handle file:// URIs - check for .json extension
        if (url.startsWith('file://')) {
            return url.toLowerCase().endsWith('.json');
        }
        // Handle content:// URIs - they typically come from file managers/providers.
        // content:// URIs (e.g. content://com.android.providers.downloads.documents/document/123)
        // carry no filename, extension or MIME type in the string, so the type cannot be
        // derived here. Accept unconditionally and validate later in extractJsonFromIntent:
        // a non-JSON file fails JSON.parse and is surfaced as a generic "invalid" alert in App.vue.
        if (url.startsWith('content://')) {
            return true;
        }
        return false;
    },

    /**
     * Extract and parse JSON file content from Android file intent
     * @param {string} fileUrl - The file URL from the intent
     * @returns {Promise<Object>} - The parsed JSON data
     * @throws {Error} - If file cannot be read or is not valid JSON
     */
    async extractJsonFromIntent(fileUrl) {
        const language = useRootStore().language;
        let fileContent;

        try {
            if (fileUrl.startsWith('content://')) {
                // Handle content:// URIs using Capacitor's Filesystem readFile
                // which can handle content provider URIs
                fileContent = await Filesystem.readFile({
                    path: fileUrl,
                    encoding: 'utf8'
                });
            } else {
                // Handle file:// URIs - extract file path and read
                const filePath = fileUrl.replace('file://', '');
                fileContent = await Filesystem.readFile({
                    path: filePath,
                    encoding: 'utf8'
                });
            }
        } catch (error) {
            console.error('Failed to read file from intent:', error);
            throw new Error(STRINGS[language].labels.cannot_read_file);
        }

        // Parse and return the JSON data
        try {
            return JSON.parse(fileContent.data);
        } catch (parseError) {
            console.error('Failed to parse JSON from file intent:', parseError);
            throw new Error(STRINGS[language].labels.invalid_project_json);
        }
    }
};

