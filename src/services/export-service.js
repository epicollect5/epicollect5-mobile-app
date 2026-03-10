import {STRINGS} from '@/config/strings';
import {utilsService} from '@/services/utilities/utils-service';
import {useRootStore} from '@/stores/root-store';
import {projectModel} from '@/models/project-model.js';
import {databaseSelectService} from '@/services/database/database-select-service';
import {JSONTransformerService} from '@/services/utilities/json-transformer-service';
import {exportMediaService} from '@/services/filesystem/export-media-service';
import {mediaDirsService} from '@/services/filesystem/media-dirs-service';
import {writeFileService} from '@/services/filesystem/write-file-service';
import {PARAMETERS} from '@/config';
import {Capacitor} from '@capacitor/core';
import {CapacitorZip} from '@capgo/capacitor-zip';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

export const exportService = {

    async exportHierarchyEntries(projectRef, directory = Directory.Documents) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const forms = Object.values(projectModel.getForms());
        const mappings = projectModel.getProjectMappings();
        let offset;
        let formIndex = 0;
        const debugLines = [];

        //do we have a mapping? If not, bail out (user must update project)
        if (Object.entries(mappings).length === 0) {
            return Promise.reject(STRINGS[language].status_codes.ec5_322);
        }

        return new Promise((resolve, reject) => {

            async function processForm(form) {
                const formRef = form.details.ref;
                const headers = JSONTransformerService.getFormCSVHeaders(
                    form,
                    mappings,
                    false,
                    formIndex,
                    false
                );
                if (PARAMETERS.DEBUG) {
                    debugLines.push(headers);
                }

                async function getEntry(offset) {
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
                            try {
                                await processForm(forms.shift());
                            } catch (error) {
                                reject(error);
                            }
                        } else {
                            //no more forms
                            console.log('all forms written ->>>>>>>>>');
                            // 4. Console log everything at once as a single block
                            if (PARAMETERS.DEBUG) {
                                console.log('--- FULL CSV DEBUG OUTPUT ---');
                                console.log(debugLines.join('\n'));
                                console.log('--- END CSV DEBUG OUTPUT ---');
                            }
                            resolve();
                        }
                    } else {
                        const entry = result.rows.item(0);
                        const formRef = form.details.ref;
                        const row = await JSONTransformerService.getFormCSVRow(
                            entry,
                            form,
                            JSON.parse(entry.answers),
                            false
                        );
                        //write entry to file if native platform
                        if (Capacitor.isNativePlatform()) {
                            try {
                                await writeFileService.appendCSVRow(
                                    headers,
                                    row,
                                    formRef,
                                    offset,
                                    null,
                                    directory
                                );
                            } catch (error) {
                                reject(error);
                                return;
                            }
                        }
                        if (PARAMETERS.DEBUG) {
                            debugLines.push(row);
                        }
                        //next entry
                        offset++;
                        try {
                            await getEntry(offset);
                        } catch (error) {
                            reject(error);
                        }
                    }
                }

                //get all entries for this project (entries + branch entries)
                //recursively, get 1 entry, write as csv row, get next one
                //1 file per each form, 1 file per each branch
                offset = 0; //<-- reset offset for db query
                try {
                    await getEntry(offset);
                } catch (error) {
                    reject(error);
                }
            }

            processForm(forms.shift()).catch((error) => {
                console.log(error);
                reject(error);
            });
        });
    },
    async exportBranchEntries(projectRef, directory = Directory.Documents) {

        const branches = [];
        const debugLines = [];
        let offset;

        return new Promise((resolve, reject) => {

            (async function () {
                //get all the branch entries for all the forms
                try {
                    const result = await databaseSelectService.selectDistinctBranchRefs(projectRef);

                    if (result.rows.length > 0) {
                        for (let i = 0; i < result.rows.length; i++) {
                            const currentBranch = result.rows.item(i);
                            branches.push({
                                branchRef: currentBranch.owner_input_ref,
                                formRef: currentBranch.form_ref
                            });
                        }
                        try {
                            await processBranch(branches.shift());
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        resolve();
                    }
                } catch (error) {
                    console.log(error);
                    reject(error);
                }

                async function processBranch(branch) {

                    const mappings = projectModel.getProjectMappings();
                    const ownerInputRef = branch.branchRef;
                    //get branch headers first
                    const headers = JSONTransformerService.getBranchCSVHeaders(
                        branch,
                        mappings
                    );

                    if (PARAMETERS.DEBUG) {
                        debugLines.push(headers);
                    }

                    async function getBranchEntry(offset) {
                        const result = await databaseSelectService.selectOneBranchEntryForExport(
                            projectRef,
                            ownerInputRef,
                            offset
                        );
                        //no more branch entries for this branch?
                        if (result.rows.length === 0) {
                            //next branch?
                            if (branches.length > 0) {
                                try {
                                    await processBranch(branches.shift());
                                } catch (error) {
                                    reject(error);
                                }
                            } else {
                                //no more branches
                                console.log('all branches written ->>>>>>>>>');
                                // 4. Console log everything at once as a single block
                                if (PARAMETERS.DEBUG) {
                                    console.log('--- FULL CSV DEBUG OUTPUT ---');
                                    console.log(debugLines.join('\n'));
                                    console.log('--- END CSV DEBUG OUTPUT ---');
                                }
                                resolve();
                            }
                        } else {
                            const branchEntry = result.rows.item(0);
                            const row = await JSONTransformerService.getBranchCSVRow(
                                branchEntry,
                                branch,
                                JSON.parse(branchEntry.answers),
                                false
                            );

                            //write entry to file on native platform
                            if (Capacitor.isNativePlatform()) {
                                try {
                                    await writeFileService.appendCSVRow(
                                        headers,
                                        row,
                                        branch.formRef,
                                        offset,
                                        branch.branchRef,
                                        directory
                                    );
                                } catch (error) {
                                    reject(error);
                                    return;
                                }
                            }

                            if (PARAMETERS.DEBUG) {
                                debugLines.push(row);
                            }

                            //next entry
                            offset++;
                            try {
                                await getBranchEntry(offset);
                            } catch (error) {
                                reject(error);
                            }
                        }
                    }

                    //get all branch entries for this branch
                    //recursively, get 1 entry, write as csv row, get next one
                    //1 file per each branch
                    offset = 0; //<-- reset offset for db query
                    try {
                        await getBranchEntry(offset);
                    } catch (error) {
                        reject(error);
                    }
                }
            }());
        });
    },
    async exportMedia(projectRef, projectSlug, directory = Directory.Documents) {
        try {
            await mediaDirsService.removeExternalMediaDirs(projectSlug, directory);
            await exportMediaService.execute(projectRef, projectSlug, directory);
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    async exportEntries(projectRef, projectSlug) {
        const projectName = projectModel.getProjectName();
        const archiveDirectory = mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem();
        const archivePath = utilsService.getExportPath(projectSlug, archiveDirectory); // ← not hardcoded
        const dateOnly = new Date().toISOString().split('T')[0];
        const zipFileName = `Epicollect5_${projectSlug}_${dateOnly}.zip`;
        try {
            // Wipe previous archive if exists
            await Filesystem.rmdir({
                path: archivePath,
                directory: archiveDirectory,
                recursive: true
            }).catch((error) => {
                console.log('No previous archive to remove:', error);
            });

            // Write everything directly to Data/archive/
            await exportService.exportHierarchyEntries(projectRef, archiveDirectory);
            await exportService.exportBranchEntries(projectRef, archiveDirectory);
            await exportService.exportMedia(projectRef, projectSlug, archiveDirectory);

            // Zip from Data/archive/ → Cache
            const sourceResult = await Filesystem.getUri({
                directory: archiveDirectory,
                path: archivePath
            });
            const destResult = await Filesystem.getUri({
                directory: Directory.Cache,
                path: zipFileName
            });

            const sourcePath = sourceResult.uri.replace('file://', '');
            const destPath = destResult.uri.replace('file://', '');



            await CapacitorZip.zip({
                source: sourcePath,
                destination: destPath
            });

            await Share.share({
                title: `Epicollect5 -- ${projectName}`,
                url: destResult.uri
            });

        } catch (error) {
            console.error('Archive failed:', error);
            throw error;
        } finally {
            // Always cleanup
            await Filesystem.rmdir({
                path: archivePath,
                directory: archiveDirectory,
                recursive: true
            }).catch((error) => {
                console.log('No archive to remove:', error);
            });

            await Filesystem.deleteFile({
                path: zipFileName,
                directory: Directory.Cache
            }).catch((error) => {
                console.log('No zip file to remove:', error);
            });
        }
    }
};
