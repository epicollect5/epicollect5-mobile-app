import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';

export const uploadMediaService = {

    // need to handle server errors/unexpected errors etc.
    // check file uploads, cordova errors:
    // 'Uncaught SyntaxError: Unexpected token o'
    // 'Uncaught SyntaxError: Unexpected token u'

    //Function to upload media
    execute(files, total, currentEntryIndex) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        let jwt;

        //update progress counter
        function _updateProgress(count) {
            count ? currentEntryIndex += count : currentEntryIndex++;
            notificationService.setProgress({ total, done: currentEntryIndex });
        }

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            databaseSelectService.getUser().then(function (res) {
                // Check if we have one and add to entry
                if (res.rows.length > 0) {
                    jwt = res.rows.item(0).jwt;
                }

                const slug = projectModel.getSlug();
                const uploader = new window.FileTransfer();
                const options = new window.FileUploadOptions();
                const upload_URL = projectModel.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug;
                let file_URI;

                let errors = false;
                // Default error object
                let errorObj = {
                    errors: [{
                        code: 'ec5_116',
                        source: '',
                        title: STRINGS[language].status_codes.ec5_116
                    }]
                };

                function _uploadOneFile(file, total, currentEntryIndex) {

                    let media_dir;

                    //get media dir
                    switch (file.file_type) {
                        case PARAMETERS.QUESTION_TYPES.AUDIO:
                            media_dir = PARAMETERS.AUDIO_DIR;
                            break;
                        case PARAMETERS.QUESTION_TYPES.PHOTO:
                            media_dir = PARAMETERS.PHOTO_DIR;
                            break;
                        case PARAMETERS.QUESTION_TYPES.VIDEO:
                            media_dir = PARAMETERS.VIDEO_DIR;
                            break;
                        default:
                        //do nothing
                    }

                    function _onSuccess(r) {
                        console.log('Code = ' + r.responseCode);
                        console.log('Response = ' + r.response);
                        console.log('Sent = ' + r.bytesSent);
                        // todo: check the response was ok
                        if (r.responseCode === 200) {
                            //update progress dialog

                            _updateProgress();
                            _uploadNext(1);
                        } else {
                            //todo: not sure what this is
                            notificationService.hideProgressDialog();
                            notificationService.showToast(STRINGS[language].status_codes.ec5_125);
                        }
                    }

                    function _onError(error) {
                        console.log(error);
                        notificationService.hideProgressDialog();
                        // Store reference to this error
                        errors = true;
                        if (error.body) {
                            try {
                                errorObj = JSON.parse(error.body);
                                try {
                                    if (errorObj.errors[0]?.code === 'ec5_77') {
                                        //authentication error, reject
                                        errors = false;//=> no entries errors...
                                        reject({
                                            data: {
                                                errors: [{
                                                    code: 'ec5_77',
                                                    source: '',
                                                    title: STRINGS[language].status_codes.ec5_77
                                                }]
                                            }
                                        });
                                        return false;
                                    } else {
                                        reject({ data: errorObj });
                                    }
                                }
                                catch (e) {
                                    reject({ data: errorObj });
                                }
                            } catch (e) {
                                reject({ data: errorObj });
                            }
                            //todo catch file read error on the server
                            _uploadNext(0, errorObj);
                        }
                        else {
                            //no internet connection? (body should be null)
                            utilsService.hasInternetConnection().then((connected) => {
                                if (!connected) {
                                    errorObj = {
                                        errors: [{
                                            code: 'ec5_330',
                                            source: '',
                                            title: STRINGS[language].status_codes.ec5_330
                                        }]
                                    };
                                }
                                //todo catch file read error on the server
                                _uploadNext(0, errorObj);
                            });
                        }
                    }

                    function _uploadNext(synced, error) {
                        // Update synced via main entry_uuid column
                        databaseUpdateService.updateFileEntrySynced(file.id, synced, error).then(function (res) {
                            console.log('Syncing');
                            currentEntryIndex++;

                            notificationService.setProgress({ total, done: currentEntryIndex });

                            // If no more files left to upload
                            if (files.length === 0) {
                                resolve(errors);
                            } else {
                                // Call _uploadOneFile(), popping off one file from files array
                                //Throw in a delay to avoid server overload
                                window.setTimeout(async function () {

                                    //if the error was caused by a dropped internet connection, stop here.
                                    // (and re-fetch entries, maybe some uploads went through)
                                    const hasInternetConnection = await utilsService.hasInternetConnection();
                                    if (!hasInternetConnection) {
                                        errorsService.handleWebError({ data: errorObj });
                                        resolve(errors);
                                    }
                                    else {
                                        //connection is good, go on even if there is an error
                                        _uploadOneFile(files.pop(), total, currentEntryIndex);
                                    }
                                }, 2 * PARAMETERS.DELAY_LONG);
                            }
                        }, function (error) {
                            resolve(error);
                        });
                    }

                    // Set options for multipart entity file
                    //options.httpMethod = 'POST';
                    options.mimeType = utilsService.getMIMEType(file.file_type);
                    //options.mimeType = '';
                    options.fileKey = 'name';
                    options.fileName = file.file_name;
                    options.params = {
                        data: JSON.stringify(JSONTransformerService.makeJsonFileEntry(file))
                    };
                    // options.trustAllHosts = true;
                    // console.log(options.fileName);
                    // console.log(options.params.data);
                    // Check if we have one and add to entry
                    if (jwt) {
                        options.headers = { Authorization: 'Bearer ' + jwt };
                    }
                    //get file from app private folder
                    file_URI = rootStore.persistentDir + media_dir + file.project_ref + '/' + file.file_name;
                    //append protocol for ios
                    if (rootStore.device.platform === PARAMETERS.IOS) {
                        file_URI = 'file://' + file_URI;
                        options.chunkedMode = false;
                    }
                    // //check if the file exists (it might be corrupted or missing)
                    // window.resolveLocalFileSystemURL(file_URI, function (success) {
                    //     //  upload_URL = 'http://vps140384.ovh.net/postdump/upload/';
                    //     // Perform the upload
                    //     uploader.upload(file_URI, upload_URL, _onSuccess, _onError, options);
                    // }, function (error) {
                    //     console.log('File not found: error code ->', error.code);
                    //
                    //     //no file was found, maybe an error while saving locally (low battery/storage etc...)
                    //     //todo update db accordingly? Otherwise it will show 'file available' but no file is there....
                    //     //skip to next file
                    //     _uploadNext(1);
                    // });

                    // Perform the upload
                    uploader.upload(file_URI, upload_URL, _onSuccess, _onError, options);
                }
                if (files.length > 0) {
                    // Begin file upload (throttle to wait between each upload)
                    window.setTimeout(function () {
                        _uploadOneFile(files.pop(), total, currentEntryIndex);
                    }, 2 * PARAMETERS.DELAY_LONG);
                }
            });
        });
    }
};
