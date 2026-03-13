/*

*/
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';

export const writeFileService = {

    async appendCSVRow (headers, row, formRef, offset, branchRef, destination = Directory.Documents) {
        const filepath = this.getCSVFilePath(formRef, branchRef, destination);

        if (offset === 0) {
            await Filesystem.writeFile({
                path: filepath,
                data: '\uFEFF' + headers, // Add UTF-8 BOM for Excel compatibility
                directory: destination,
                encoding: Encoding.UTF8,
                recursive: true
            });
        }
        //append entry data (if any)
        //we cannot append empty string, throws NO_DATA error
        if (row.length > 0) {
            await Filesystem.appendFile({
                path: filepath,
                data: '\r\n' + row,
                directory: destination,
                encoding: Encoding.UTF8
            });
        }
    },

    getCSVFilePath (formRef, branchRef, destination = Directory.Documents) {
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
            const defaultMapping = mappings.filter((mapping) => {
                if (mapping.is_default) {
                    return mapping.forms;
                }
            });
            let branchIndex = 0;
            const branchHeader = projectExtra.inputs[branchRef].data.question;

            for (const [inputRef, _input] of Object.entries(defaultMapping[0].forms[formRef])) {
                if (inputRef === branchRef) {
                    // Prepend form index (formIndex + 1 to start from 1) to branch identifier
                    filename = utilsService.generateFilenameForExport('form-' + (formIndex + 1) + '_branch-' + (branchRef), formName + '-' + branchHeader);
                    break;
                }
                branchIndex++;
            }
        }
        else {
            // formIndex + 1 to start from 1
            filename = utilsService.generateFilenameForExport('form-' + (formIndex + 1), formName);
        }
        const folder = utilsService.getExportPath(projectSlug, destination);

        path = folder + '/data/' + filename + '.csv';
        return path;
    }
};
