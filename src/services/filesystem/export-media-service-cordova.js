/*
Export media files by copying them for the app private folders
to a user accessible folder on the device
Android - Download/epicollect5/{projectSlug} folder
iOS - todo:
Web - N/A
*/

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { utilsService } from '@/services/utilities/utils-service';

export const exportMediaServiceCordova = {

    async execute(projectRef, projectSlug) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        // e.g., "Download/epicollect5/"
        const downloadFolder = utilsService.getPlatformDocumentsFolder();
        const persistentDir = rootStore.persistentDir;

        return new Promise((resolve, reject) => {
            const self = this;

            window.resolveLocalFileSystemURL(cordova.file.dataDirectory, (dataDirEntry) => {
                // Get handle for External Storage (Android Downloads or iOS Documents)
                const storageBase = (rootStore.device.platform === PARAMETERS.ANDROID)
                    ? cordova.file.externalRootDirectory
                    : cordova.file.documentsDirectory;

                window.resolveLocalFileSystemURL(storageBase, (storageEntry) => {

                    // 1. Create the destination folder structure recursively
                    // "Download/epicollect5/my-project"
                    const fullDestPath = downloadFolder + projectSlug;

                    self.getRecursiveDirectory(storageEntry, fullDestPath).then((projectDestEntry) => {

                        const types = [
                            { dir: PARAMETERS.PHOTO_DIR, label: 'photos' },
                            { dir: PARAMETERS.AUDIO_DIR, label: 'audios' },
                            { dir: PARAMETERS.VIDEO_DIR, label: 'videos' }
                        ];

                        let completed = 0;
                        const errors = 0;

                        types.forEach(type => {
                            const sourcePath = type.dir + projectRef;

                            // Try to find the source folder
                            dataDirEntry.getDirectory(sourcePath, { create: false }, (sourceDirEntry) => {
                                // Copy the folder into the project destination
                                sourceDirEntry.copyTo(projectDestEntry, type.dir.replace(/\//g, ''), () => {
                                    completed++;
                                    if (completed === types.length) resolve();
                                }, (err) => {
                                    console.error('Copy failed for ' + type.label, err);
                                    completed++;
                                    if (completed === types.length) resolve();
                                });
                            }, () => {
                                // Source dir doesn't exist, skip
                                completed++;
                                if (completed === types.length) resolve();
                            });
                        });
                    }).catch(reject);
                }, reject);
            }, reject);
        });
    },

    // Helper to create nested folders in Cordova
    getRecursiveDirectory(baseEntry, path) {
        const folders = path.split('/').filter((part) => part !== '');
        return new Promise((resolve, reject) => {
            const createDir = (entry, folderList) => {
                if (folderList.length === 0) return resolve(entry);
                entry.getDirectory(folderList.shift(), { create: true }, (nextEntry) => {
                    createDir(nextEntry, folderList);
                }, reject);
            };
            createDir(baseEntry, folders);
        });
    }
};
