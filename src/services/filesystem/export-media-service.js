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
import { Filesystem, Directory } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';


export const exportMediaService = {

    async execute (projectRef, projectSlug) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const downloadFolder = utilsService.getPlatformDownloadFolder();
        const persistentDir = rootStore.persistentDir;
        const photoDirSource = persistentDir + PARAMETERS.PHOTO_DIR + projectRef;
        const audioDirSource = persistentDir + PARAMETERS.AUDIO_DIR + projectRef;
        const videoDirSource = persistentDir + PARAMETERS.VIDEO_DIR + projectRef;

        const photosDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.PHOTO_DIR;
        const audioDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.AUDIO_DIR;
        const videoDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.VIDEO_DIR;

        return new Promise((resolve, reject) => {
            (async function () {
                //find out what folders exists
                const dirExistsPhoto = await mediaDirsService.dirExists(photoDirSource);
                const dirExistsAudio = await mediaDirsService.dirExists(audioDirSource);
                const dirExistsVideo = await mediaDirsService.dirExists(videoDirSource);

                //any errors bail out
                if (dirExistsPhoto === null || dirExistsAudio === null || dirExistsVideo === null) {
                    reject(labels.unknown_error);
                }

                //copy the existing folders to external storage
                try {
                    if (dirExistsPhoto) {
                        await Filesystem.copy({
                            from: photoDirSource,
                            to: photosDirDestination,
                            toDirectory: Directory.ExternalStorage
                        });
                    }
                    if (dirExistsAudio) {
                        await Filesystem.copy({
                            from: audioDirSource,
                            to: audioDirDestination,
                            toDirectory: Directory.ExternalStorage
                        });
                    }
                    if (dirExistsVideo) {
                        await Filesystem.copy({
                            from: videoDirSource,
                            to: videoDirDestination,
                            toDirectory: Directory.ExternalStorage
                        });
                    }
                    //all done
                    resolve();
                } catch (error) {
                    console.log(error);
                    reject(error);
                }
            }());
        });
    }
};
