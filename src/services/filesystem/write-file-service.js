/*

*/
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';

export const writeFileService = {

    async appendCSVRow (headers, row, formRef, offset, branchRef) {
        const self = this;
        return new Promise((resolve, reject) => {

            (async function () {

                const filepath = self.getFilePath(formRef, branchRef);

                if (offset === 0) {
                    try {
                        await Filesystem.writeFile({
                            path: filepath,
                            data: headers.join(','),
                            directory: Directory.ExternalStorage,
                            encoding: Encoding.UTF8,
                            recursive: true
                        });
                    } catch (error) {
                        reject(error);
                    }
                }
                //append entry data (if any)
                //we cannot append empty string, throws NO_DATA error
                if (row.length > 0) {
                    try {
                        await Filesystem.appendFile({
                            path: filepath,
                            data: '\r\n' + row,
                            directory: Directory.ExternalStorage,
                            encoding: Encoding.UTF8
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            }());
        });
    },
    getFilePath (formRef, branchRef) {

        const downloadFolder = utilsService.getPlatformDownloadFolder();
        const projectSlug = projectModel.getSlug();
        const mappings = projectModel.getProjectMappings();
        const projectExtra = projectModel.getProjectExtra();
        //get form index (forms and branches can have same name, 
        //that would override the file)
        const formIndex = projectModel.getFormIndex(formRef);
        const formName = projectModel.getFormName(formRef);
        let filename = '';
        let path = '';

        if (branchRef !== null) {
            //todo:
            const defaultMapping = mappings.filter((mapping) => {
                if (mapping.is_default) {
                    return mapping.forms;
                }
            });
            let branchIndex = 0;
            const branchHeader = projectExtra.inputs[branchRef].data.question;

            for (const [inputRef, input] of Object.entries(defaultMapping[0].forms[formRef])) {
                if (inputRef === branchRef) {
                    // branchIndex + 1 to start from 1
                    filename = utilsService.generateFilenameForExport('branch-' + (branchIndex + 1), branchHeader);
                    break;
                }
                branchIndex++;
            }
        }
        else {
            // formIndex + 1 to start from 1
            filename = utilsService.generateFilenameForExport('form-' + (formIndex + 1), formName);
        }
        path = downloadFolder + projectSlug + '/' + filename + '.csv';
        return path;
    }
};
