import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { formModel } from '@/models/form-model';
import { entryModel } from '@/models/entry-model';
import { useRootStore } from '@/stores/root-store';
import { errorsService } from '@/services/errors-service';
import { entryService } from '@/services/entry/entry-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { webService } from '@/services/web-service';

export async function setupPWAEntry (action, isBranch) {
    return new Promise((resolve, reject) => {

        let formRef;
        let parentFormRef;
        let parentEntryUuid;
        let branchRef = '';
        let branchOwnerUuid = '';
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

        if (isBranch) {
            branchRef = searchParams.get('branch_ref');
            branchOwnerUuid = searchParams.get('branch_owner_uuid');
        }

        //are we adding a new entry?
        if (action === PARAMETERS.PWA_ADD_ENTRY) {
            if (isBranch) {
                //use branch service
                branchEntryService.setUpNew(formRef, branchRef, branchOwnerUuid);
                rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
            }
            else {
                //use hierarchy service
                entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);
            }

            //initialise formModel
            formModel.initialise(projectModel.getExtraForm(formRef));
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
                    const response = await webService.downloadEntryPWA(projectSlug, formRef, entryUuid, branchRef, branchOwnerUuid);
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
                const entryType = webEntry.type;
                const entry = {
                    entryUuid,
                    parentEntryUuid,
                    isRemote: 0,
                    synced: 0,
                    canEdit: 1,
                    createdAt: webEntry[entryType].createdAt,
                    title: webEntry[entryType].title,
                    formRef,
                    parentFormRef,
                    projectRef,
                    branchEntries: {},
                    media: {},
                    uniqueAnswers: {},
                    syncedError: '',
                    isBranch,
                    verifyAnswers: {},
                    answers: webEntry[entryType].answers
                };

                const data = {
                    entry_uuid: entryUuid,
                    answers: JSON.stringify(webEntry[entryType].answers),
                    form_ref: formRef,
                    parent_form_ref: parentFormRef,
                    parent_entry_uuid: parentEntryUuid,
                    project_ref: projectRef,
                    created_at: webEntry[entryType].createdAt,
                    title: webEntry[entryType].title,
                    synced: 0,
                    synced_error: '',
                    can_edit: 1,
                    is_remote: 0
                };

                //initialise formModel
                formModel.initialise(projectModel.getExtraForm(formRef));

                //initialise entryModel
                entryModel.initialise(data);

                if (isBranch) {
                    entry.ownerInputRef = branchRef;
                    entry.ownerEntryUuid = branchOwnerUuid;
                    await branchEntryService.setUpExisting(entry);

                    rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
                }
                else {
                    entryService.setUpExisting(entry);
                }
                resolve(formRef);
            })();
        }
    });
}
