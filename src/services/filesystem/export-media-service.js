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

        const destinationFolder = Directory.Documents; // Standard for both Android and iOS visibility
        const sourceFolder = mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem();

        // SANITIZE: Remove leading/trailing slashes to prevent Code 5 iOS
        const cleanProjectSlug = projectSlug.replace(/^\/|\/$/g, '');
        const cleanPhotoDir = PARAMETERS.PHOTO_DIR.replace(/^\/|\/$/g, '');
        const cleanAudioDir = PARAMETERS.AUDIO_DIR.replace(/^\/|\/$/g, '');
        const cleanVideoDir = PARAMETERS.VIDEO_DIR.replace(/^\/|\/$/g, '');

        // Construct relative paths WITHOUT leading slashes
        const photoFrom = cleanPhotoDir + '/' + projectRef;
        const audioFrom = cleanAudioDir + '/' + projectRef;
        const videoFrom = cleanVideoDir + '/' + projectRef;

        try {
            // 1. Check existence explicitly
            let folderExists = false;
            try {
                await Filesystem.stat({
                    path: cleanProjectSlug,
                    directory: destinationFolder
                });
                folderExists = true;
            } catch (e) {
                // If stat fails, it's just not there. We don't need to check the message.
                folderExists = false;
            }

            // 2. Act only if needed
            if (!folderExists) {
                await Filesystem.mkdir({
                    path: cleanProjectSlug,
                    directory: destinationFolder,
                    recursive: true
                });
                console.log('Clean mkdir performed.');
            }
            // 3. Perform Copies
            // PHOTOS
            try {
                await Filesystem.copy({
                    from: photoFrom,
                    directory: sourceFolder,
                    to: cleanProjectSlug + '/' + cleanPhotoDir,
                    toDirectory: destinationFolder
                });
            } catch (e) {
                console.log('No photos found or copy failed', e);
            }

            // AUDIOS
            try {
                await Filesystem.copy({
                    from: audioFrom,
                    directory: sourceFolder,
                    to: cleanProjectSlug + '/' + cleanAudioDir,
                    toDirectory: destinationFolder
                });
            } catch (e) {
                console.log('No audios found', e);
            }

            // VIDEOS
            try {
                await Filesystem.copy({
                    from: videoFrom,
                    directory: sourceFolder,
                    to: cleanProjectSlug + '/' + cleanVideoDir,
                    toDirectory: destinationFolder
                });
            } catch (e) {
                console.log('No videos found', e);
            }

            return true;
        } catch (error) {
            console.error('Export error details:', error);
            throw labels.unknown_error;
        }
    }
};

