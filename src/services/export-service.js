import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { exportMediaService } from '@/services/filesystem/export-media-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { writeFileService } from '@/services/filesystem/write-file-service';

export const exportService = {

    async exportHierarchyEntries (projectRef, projectSlug) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const forms = Object.values(projectModel.getForms());
        const mappings = projectModel.getProjectMappings();
        let offset;
        let formIndex = 0;

        //do we have a mapping? If not, bail out (user must update project)
        if (Object.entries(mappings).length === 0) {
            return Promise.reject(STRINGS[language].status_codes.ec5_322);
        }

        return new Promise((resolve, reject) => {

            function processForm (form) {
                const formRef = form.details.ref;
                const headers = JSONTransformerService.getFormCSVHeaders(
                    form,
                    mappings,
                    false,
                    formIndex,
                    false
                );

                async function getEntry (offset) {
                    const result = await databaseSelectService.selectOneEntry(
                        projectRef,
                        formRef,
                        null,
                        null,
                        offset
                    );

                    if (result.rows.length === 0) {
                        //no more hierarchy entries for this form, we are done with those

                        //next form?
                        if (forms.length > 0) {
                            //next form
                            formIndex++;
                            //reset offset for db query
                            offset = 0;
                            processForm(forms.shift());
                        } else {
                            //no more forms
                            console.log('all forms written ->>>>>>>>>');
                            resolve();
                        }
                    } else {
                        const entry = result.rows.item(0);
                        const formRef = form.details.ref;
                        const rowArray = await JSONTransformerService.getFormCSVRow(
                            entry,
                            form,
                            JSON.parse(entry.answers),
                            false
                        );
                        const rowCSV = rowArray.join(',');
                        //write entry to file
                        try {
                            await writeFileService.appendCSVRow(headers, rowCSV, formRef, offset, null);
                        } catch (error) {
                            reject(error);
                            return;
                        }
                        //next entry
                        offset++;
                        await getEntry(offset);
                    }
                }
                //get all entries for this project(entries + branch entries)
                //recursively, get 1 entry, write as csv row, get next one
                //1 file per each form, 1 file per each branch
                offset = 0;
                getEntry(offset);
            }


            processForm(forms.shift());
        });
    },
    async exportBranchEntries (projectRef) {

        const branches = [];
        let offset;

        return new Promise((resolve, reject) => {

            (async function () {
                //get all the branch entries for all the forms
                const result = await databaseSelectService.selectDistinctBranchRefs(projectRef);

                if (result.rows.length > 0) {
                    for (let i = 0; i < result.rows.length; i++) {
                        const currentBranch = result.rows.item(i);
                        branches.push({
                            branchRef: currentBranch.owner_input_ref,
                            formRef: currentBranch.form_ref
                        });
                    }
                    processBranch(branches.shift());
                }
                else {
                    resolve();
                }

                async function processBranch (branch) {

                    const mappings = projectModel.getProjectMappings();
                    const ownerInputRef = branch.branchRef;
                    //get branch headers first
                    const headers = JSONTransformerService.getBranchCSVHeaders(
                        branch,
                        mappings
                    );

                    async function getBranchEntry (offset) {
                        const result = await databaseSelectService.selectOneBranchEntryForExport(
                            projectRef,
                            ownerInputRef,
                            offset
                        );

                        if (result.rows.length === 0) {
                            //no more branch entries for this branch

                            //next branch?
                            if (branches.length > 0) {
                                //reset offset for db query
                                offset = 0;
                                processBranch(branches.shift());
                            } else {
                                //no more branches
                                console.log('all branches written ->>>>>>>>>');
                                resolve();
                            }
                        }
                        else {
                            const branchEntry = result.rows.item(0);
                            const row = await JSONTransformerService.getBranchCSVRow(
                                branchEntry,
                                branch,
                                JSON.parse(branchEntry.answers),
                                false
                            );

                            //write entry to file
                            try {
                                await writeFileService.appendCSVRow(headers, row, branch.formRef, offset, branch.branchRef);
                            } catch (error) {
                                reject(error);
                                return;
                            }
                            //next entry
                            offset++;
                            await getBranchEntry(offset);
                        }
                    }

                    //todo: get rows, 1 at a time
                    //get all branch entries for this branch
                    //recursively, get 1 entry, write as csv row, get next one
                    //1 file per each branch
                    offset = 0;
                    await getBranchEntry(offset);
                }
            }());
        });
    },
    async exportMedia (projectRef, projectSlug) {
        try {
            await mediaDirsService.removeExternalMediaDirs(projectSlug);
            await exportMediaService.execute(projectRef, projectSlug);
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
};
