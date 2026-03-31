import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';

export const clipboardService = {
    /**
     * Copies the given text to the clipboard.
     * Handles permissions automatically via Capacitor.
     * @param {string} text - The text to copy
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    async copyText(text) {
        try {
            if (!Capacitor.isNativePlatform()) {
                return false;
            } else {
                // Native platforms: use Capacitor Clipboard
                await Clipboard.write({
                    string: text
                });
                return true;
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }
};
