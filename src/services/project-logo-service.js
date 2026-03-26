import {PARAMETERS} from '@/config';

import {useRootStore} from '@/stores/root-store';
import {webService} from '@/services/web-service';

export const projectLogoService = {

    // Material Design palette for deterministic colors
    palette: [
        '#F7B172',
        '#FF8500',
        '#C4A662',
        '#1D8F94',
        '#A8CE61',
        '#8C9398',
        '#875053',
        '#5DBCEB',
        '#59C2CF',
        '#AEDAF7',
        '#C23B23',
        '#8B5F78',
        '#C0424E',
        '#FD2E36',
        '#B29DD9',
        '#77DD77',
        '#EB6662',
        '#F7DC3F',
        '#F87203',
        '#EEB336',
        '#0075C2',
        '#254479',
        '#A1E23D',
        '#C64FE0',
        '#4B4B4B'
    ],

    // Calculate contrast color (black or white) based on background color for readability
    _getContrastColor(hex) {
        let color = hex.replace('#', '');

        if (color.length === 3) {
            color = color.split('').map((c) => c + c).join('');
        }

        const r = parseInt(color.slice(0, 2), 16) / 255;
        const g = parseInt(color.slice(2, 4), 16) / 255;
        const b = parseInt(color.slice(4, 6), 16) / 255;

        const transform = (c) =>
            (c <= 0.03928)
                ? c / 12.92
                : Math.pow((c + 0.055) / 1.055, 2.4);

        const L =
            0.2126 * transform(r) +
            0.7152 * transform(g) +
            0.0722 * transform(b);

        return L > 0.179 ? '#000000' : '#ffffff';
    },

    // Simple hash function to convert name to a consistent color index
    _getColorFromName(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Consistent with how Laravolt picks from the array
        const index = Math.abs(hash) % this.palette.length;
        return this.palette[index];
    },

    downloadFromServer(slug, projectRef) {
        const rootStore = useRootStore();
        return new Promise(function (resolve, reject) {

            if (rootStore.device.platform !== PARAMETERS.WEB) {
                // Get the headers first
                webService.getHeaders(true).then(
                    function (headers) {

                        //remember to add cordova whitelist plugin as if affects other plugins
                        //see t.ly/Opox
                        const fileTransfer = new window.FileTransfer();
                        const uri = encodeURI(webService.getProjectImageUrl(slug));
                        const appStorePath = rootStore.persistentDir + PARAMETERS.LOGOS_DIR + projectRef + '/mobile-logo.jpg?' + new Date().getTime();

                        fileTransfer.download(
                            uri,
                            appStorePath,
                            function (entry) {
                                console.log('download complete: ' + entry.toURL());
                                resolve();
                            },
                            function (error) {
                                console.error(error);
                                console.log('download error source ' + error.source);
                                console.log('download error target ' + error.target);
                                console.log('download error code' + error.code);
                                reject();
                            },
                            false,
                            {
                                headers: headers
                            }
                        );
                    } ).catch(function (error) {
                    console.error('Failed to get headers for logo download:', error);
                    reject();
                });
            } else {
                // If via browser, just resolve
                resolve();
            }
        });
    },

    /**
     * Generates and saves the logo using Cordova File Plugin (Offline)
     */
    async generateLocally(projectName, projectRef) {
        const rootStore = useRootStore();
        if (rootStore.device.platform === PARAMETERS.WEB) return;

        // Ensure Roboto is ready for the Canvas
        await document.fonts.load('bold 100px "Roboto"');

        const size = 128; // Server uses 128x128px for logos, so we match that for consistency
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 1. Draw Background
        const bgColor = this._getColorFromName(projectName);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);

        // 2. Prepare Initials (Max 2 chars)
        const words = projectName.trim().split(/\s+/);
        const initials = words.length >= 2
            ? (words[0][0] + words[1][0]).toUpperCase()
            : projectName.substring(0, 2).toUpperCase();

        // 3. Proportional Font (Server 128px / 1024px = 0.125 ratio)
        // 128 * 0.25 = 32px font size, which looks good for 2 chars. We can adjust if needed.
        const scaledFontSize = 32;

        ctx.fillStyle = this._getContrastColor(bgColor);
        ctx.font = `700 ${scaledFontSize}px "Roboto"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw the text in the center
        ctx.fillText(initials, size / 2, size / 2);

        // 4. Convert to Blob
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));

        // 5. Save using Async Cordova File API
        try {
            const logosDirUrl = rootStore.persistentDir + PARAMETERS.LOGOS_DIR;

            // Resolve Logos Root
            const logosDirEntry = await new Promise((res, rej) =>
                window.resolveLocalFileSystemURL(logosDirUrl, res, rej)
            );

            // Resolve/Create Project Folder (Matches downloadProjectLogo path)
            const projectDirEntry = await new Promise((res, rej) =>
                logosDirEntry.getDirectory(projectRef, { create: true }, res, rej)
            );

            // Resolve/Create File
            const fileEntry = await new Promise((res, rej) =>
                projectDirEntry.getFile('mobile-logo.jpg', { create: true, exclusive: false }, res, rej)
            );

            // Write the Data
            await new Promise((res, rej) => {
                fileEntry.createWriter((fileWriter) => {
                    fileWriter.onwriteend = res;
                    fileWriter.onerror = rej;
                    fileWriter.write(blob);
                }, rej);
            });

            console.log('✅ Offline Roboto logo saved:', fileEntry.toURL());
        } catch (error) {
            console.error('❌ Failed to save offline logo:', error);
            throw error;
        }
    }
};
