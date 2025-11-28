/*
* Write to a file (incrementally)
*
* When running "Export to json":
*
* on Android, data are saved in the public storage root, under 'Epicollect5/{project-slug}/'
* as a project-slug.json
*/
import {PARAMETERS} from '@/config';
import {utilsService} from '@/services/utilities/utils-service';
import {useRootStore} from '@/stores/root-store';

/**
 * Generate a random test image (1024x768) with random shapes and orientation
 */
const generateRandomImage = (width = 1024, height = 768) => {
    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill background with random color
    ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
    ctx.fillRect(0, 0, width, height);

    // Draw random shapes
    const shapesCount = 50 + Math.floor(Math.random() * 50); // 50-100 shapes
    for (let i = 0; i < shapesCount; i++) {
        ctx.save();

        // Random position
        const x = Math.random() * width;
        const y = Math.random() * height;

        // Random rotation
        const angle = Math.random() * 2 * Math.PI;
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Random color
        ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, ${Math.random()})`;
        ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, ${Math.random()})`;
        ctx.lineWidth = Math.random() * 5 + 1;

        // Random shape type
        const shapeType = Math.floor(Math.random() * 3);
        switch (shapeType) {
            case 0: // Rectangle
                ctx.fillRect(-20, -20, Math.random() * 40, Math.random() * 40);
                break;
            case 1: // Circle
                ctx.beginPath();
                ctx.arc(0, 0, Math.random() * 30, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                break;
            case 2: // Line
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.random() * 50 - 25, Math.random() * 50 - 25);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    // Return as Base64 PNG
    return canvas.toDataURL('image/jpeg');
};

export const fakeFilePhotoService = {

    onError(error) {
        console.log(error);
    },

    createFile(entry, media_type) {

        const self = this;

        return new Promise((resolve, reject) => {

            const rootStore = useRootStore();
            const media_dir = utilsService.getFilePath(media_type);
            const uuid = entry.entryUuid;
            const projectRef = entry.projectRef;
            const filename = utilsService.generateMediaFilename(uuid, media_type);

            function _gotFS(filesystem) {
                //create new project directory (if not exits)
                filesystem.getDirectory(projectRef, {
                        create: true,
                        exclusive: false
                    }, _onCreateProjectDirectorySuccess,
                    function (error) {
                        console.log(error);
                        reject(error);
                    });

                function _onCreateProjectDirectorySuccess(dir) {

                    // write file
                    dir.getFile(filename, {create: true}, function (file) {
                        console.log('got the file', file);

                        file.createWriter(function (fileWriter) {
                            fileWriter.onerror = function (err) {
                                self.onError(err);
                                reject(err);
                            };

                            fileWriter.onwritestart = function () {
                                console.log('Start writing file');
                            };
                            fileWriter.onwriteend = function () {
                                console.log('Finished writing file');
                                resolve(filename);
                            };
                            switch (media_type) {
                                case PARAMETERS.QUESTION_TYPES.AUDIO:
                                    if (rootStore.device.platform === PARAMETERS.ANDROID) {
                                        fileWriter.write(utilsService.b64toBlob(self.fakeAudioBase64, 'audio/mp4', null));
                                    }

                                    if (rootStore.device.platform === PARAMETERS.IOS) {
                                        fileWriter.write(utilsService.b64toBlob(self.fakeAudioBase64, 'audio/wav', null));
                                    }

                                    break;
                                case PARAMETERS.QUESTION_TYPES.PHOTO:
                                    fileWriter.write(utilsService.b64toBlob(generateRandomImage(), 'image/jpg', null));
                                    break;
                                case PARAMETERS.QUESTION_TYPES.VIDEO:
                                    fileWriter.write(utilsService.b64toBlob(self.fakeVideoBase64, 'video/mp4', null));
                                    break;
                            }
                        });
                    });
                }
            }

            //get handle to app private data folder for the media type requested
            window.resolveLocalFileSystemURL(cordova.file.dataDirectory + media_dir, _gotFS, function (error) {
                console.log(error);
                reject(error);
            });
        });
    }
};


