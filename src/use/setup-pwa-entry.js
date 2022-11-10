import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { entryModel } from '@/models/entry-model';
import { useRootStore } from '@/stores/root-store';
import { errorsService } from '@/services/errors-service';
import { entryService } from '@/services/entry/entry-service';
import { webService } from '@/services/web-service';

export async function setupPWAEntry (action) {
    return new Promise((resolve, reject) => {

        let formRef;
        let parentFormRef;
        let parentEntryUuid;
        const rootStore = useRootStore();
        const searchParams = rootStore.searchParams;

        if (searchParams.has('form_ref') && searchParams.has('parent_form_ref') && searchParams.has('parent_uuid')) {
            formRef = searchParams.get('form_ref');
            parentFormRef = searchParams.get('parent_form_ref');
            parentEntryUuid = searchParams.get('parent_uuid');
        }
        else {
            formRef = projectModel.getFirstFormRef();
            parentFormRef = '';
            parentEntryUuid = '';
        }

        if (action === PARAMETERS.PWA_ADD_ENTRY) {
            entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);
            resolve(formRef);
            return false;
        }
        else {
            (async function () {
                //get entry from server
                const projectSlug = projectModel.getSlug();
                const projectRef = projectModel.getProjectRef();
                const entryUuid = searchParams.get('uuid');
                let webEntry = null;
                try {
                    const response = await webService.downloadEntryPWA(projectSlug, formRef, entryUuid);
                    console.log(JSON.stringify(response.data.data.entries[0]));
                    if (response.data.data.entries.length > 0) {
                        webEntry = response.data.data.entries[0];
                    }
                    else {
                        reject();
                        return false;
                    }
                }
                catch (errorResponse) {
                    errorsService.handleWebError(errorResponse);
                    reject(errorResponse);
                    return false;
                }

                //build entry object
                const entry = {
                    entryUuid,
                    parentEntryUuid: '',//todo:
                    isRemote: 0,
                    synced: 0,
                    canEdit: 1,
                    createdAt: webEntry.entry.createdAt,
                    title: webEntry.entry.title,
                    formRef,
                    parentFormRef: '',//todo:
                    projectRef,
                    branchEntries: {},
                    media: {},
                    uniqueAnswers: {},
                    syncedError: '',
                    isBranch: false,//todo: handle branch edits
                    verifyAnswers: {},
                    answers: webEntry.entry.answers
                };

                const data = {
                    entry_uuid: entryUuid,
                    answers: JSON.stringify(webEntry.entry.answers),
                    form_ref: formRef,
                    parent_form_ref: '',
                    parent_entry_uuid: '',
                    project_ref: projectRef,
                    created_at: webEntry.entry.createdAt,
                    title: webEntry.entry.title,
                    synced: 0,
                    synced_error: '',
                    can_edit: 1,
                    is_remote: 0
                };
                //initialise entryModel
                entryModel.initialise(data);

                entryService.setUpExisting(entry);

                resolve(formRef);
            })();
        }
    });
}
