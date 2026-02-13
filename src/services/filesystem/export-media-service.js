/*
Export media files by copying them for the app private folders
to a user accessible folder on the device
Android - Documents/{projectSlug}
iOS - Documents/{projectSlug}
Web - N/A
*/

import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {mediaDirsService} from '@/services/filesystem/media-dirs-service';

export const exportMediaService = {

    async execute(projectRef, projectSlug) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        await Filesystem.requestPermissions();

        const destinationFolder = Directory.Documents;
        const sourceFolder = mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem();

        if (!sourceFolder) return true;

        // Use semantic path resolution
        const baseMediaPath = mediaDirsService.getExportMediaPath(projectSlug);

        const cleanPhotoDir = PARAMETERS.PHOTO_DIR.replace(/^\/|\/$/g, '');
        const cleanAudioDir = PARAMETERS.AUDIO_DIR.replace(/^\/|\/$/g, '');
        const cleanVideoDir = PARAMETERS.VIDEO_DIR.replace(/^\/|\/$/g, '');

        const photoFrom = cleanPhotoDir + '/' + projectRef;
        const audioFrom = cleanAudioDir + '/' + projectRef;
        const videoFrom = cleanVideoDir + '/' + projectRef;

        try {
            // 1. Check existence using semantic path
            let folderExists = false;
            try {
                await Filesystem.stat({ path: baseMediaPath, directory: destinationFolder });
                folderExists = true;
            } catch (e) { folderExists = false; }

            // 2. Create directory (recursive: true handles the 'Epicollect5' parent on Android)
            if (!folderExists) {
                await Filesystem.mkdir({
                    path: baseMediaPath,
                    directory: destinationFolder,
                    recursive: true
                });
            }

            // 3. Perform Copies
            const mediaTypes = [
                { from: photoFrom, dir: cleanPhotoDir },
                { from: audioFrom, dir: cleanAudioDir },
                { from: videoFrom, dir: cleanVideoDir }
            ];

            for (const type of mediaTypes) {
                try {
                    await Filesystem.copy({
                        from: type.from,
                        directory: sourceFolder,
                        to: baseMediaPath + '/' + type.dir,
                        toDirectory: destinationFolder
                    });
                } catch (e) {
                    console.log(`No ${type.dir} found to export.`);
                }
            }

            return true;
        } catch (error) {
            throw error.message || labels.unknown_error;
        }
    }
};

