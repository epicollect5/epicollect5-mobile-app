
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

export const deleteFileService = {

    //use Cordova implementation for legacy reasons
    //since we need the same file paths as the old app
    removeFiles (files) {

        return new Promise((resolve, reject) => {
            function _onGetFileSuccess (file_entry) {
                file_entry.remove(_onRemoveSuccess, _onRemoveError);
            }

            function _onGetFileError (error) {

                console.log('Error getting file: ' + JSON.stringify(error));
                //id the error code is 1 (file not found), assume the deletion was ok
                if (error.code === 1) {
                    _onRemoveSuccess();
                }
                else {
                    reject(error);
                }
            }

            function _onRemoveSuccess () {
                if (files.length > 0) {
                    _execute(files.pop());
                }
                else {
                    resolve();
                }
            }

            function _onRemoveError (error) {
                console.log('Error: ' + JSON.stringify(error));
                reject(error);
            }

            function _execute (file) {
                console.log('Deleting file: n ' + file.file_path + file.project_ref + '/' + file.file_name);
                window.resolveLocalFileSystemURL(file.file_path + file.project_ref + '/' + file.file_name, _onGetFileSuccess, _onGetFileError);
            }

            _execute(files.pop());
        });
    },

    removeFile (fileURI) {
        console.log('file to remove ->', fileURI);
        return new Promise((resolve, reject) => {
            window.resolveLocalFileSystemURL(fileURI, (fileEntry) => {
                fileEntry.remove(() => {
                    resolve();
                }, (error) => {
                    //if error code 1 (NOT FOUND) assume deletion was ok
                    error.code === 1 ? resolve() : reject(error);
                });
            }, (error) => {
                console.log(error);
                //if error code 1 (NOT FOUND) assume deletion was ok
                error.code === 1 ? resolve() : reject(error);
            });
        });
    }
};
