/**
 * Android File Intent Handler Service
 * Handles file intents from Android file manager when JSON files are opened
 */

import {Filesystem} from '@capacitor/filesystem';
import {PARAMETERS} from '@/config';

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
        // Handle content:// URIs - they typically come from file managers/providers
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
        try {
            let fileContent;

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

            // Parse and return the JSON data
            return JSON.parse(fileContent.data);
        } catch (error) {
            console.error('Failed to extract JSON from file intent:', error);
            throw new Error(`Failed to read or parse JSON file: ${error.message}`);
        }
    }
};

