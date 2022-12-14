import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { toRaw } from '@vue/reactivity';
import { useRootStore } from '@/stores/root-store';
import { entryModel } from '@/models/entry-model';

export const questionCommonService = {
    //Add common params to the input state
    setUpInputParams (state, inputRef, entriesAddState) {

        // Question input details
        const inputsExtra = projectModel.getExtraInputs();
        state.inputDetails = inputsExtra[inputRef].data;

        // Current input ref
        state.currentInputRef = inputRef;
        // Check if any errors
        console.log({ 'entriesAddState.error': entriesAddState.error });
        console.log(JSON.stringify(entriesAddState.error));
        state.error = entriesAddState.error;
        // Required
        state.required = state.inputDetails.is_required;
        // Question
        state.question = state.inputDetails.question;
        // Regex pattern
        state.pattern = state.inputDetails.regex;

        //imp: https://vuejs.org/api/reactivity-advanced.html#toraw
        //imp: toRaw() get used to avoid creating nested proxy and
        //imp: lose state.answer reactivity when editing branch entries
        //imp: on Android (worked anyway in Chrome browser but not in WebvView)

        //imp: another options could be using pinia to store the answers
        //imp: instead of entriesAddState (provide/inject)

        // Get the answer for this question
        state.answer = toRaw(entriesAddState.answers[inputRef]);
        // Get the confirm answer for this question (if any)
        state.confirmAnswer = toRaw(entriesAddState.confirmAnswer[inputRef]);
    },

    getNavigationParamsPWA (entryService) {

        const rootStore = useRootStore();
        let routeName = '';

        const routeParams = {
            projectRef: projectModel.getProjectRef(),
            formRef: entryService.entry.formRef
        };

        switch (entryService.action) {
            case PARAMETERS.ENTRY_EDIT:
                routeParams.entryUuid = entryService.entry.entryUuid;
                if (!entryService.entry.isBranch) {
                    routeName = PARAMETERS.ROUTES.PWA_QUIT;
                } else {
                    if (rootStore.branchEditType === PARAMETERS.PWA_BRANCH_REMOTE) {
                        //this is a remote branch entry edit, just quit
                        // (no temp entry in memory)
                        routeName = PARAMETERS.ROUTES.PWA_QUIT;
                    }
                    else {
                        //this was a pwa temp branch editing, go back to hierarchy entry
                        routeName = PARAMETERS.ROUTES.ENTRIES_ADD;
                        routeParams.entryUuid = entryService.entry.entryUuid;
                        routeParams.ownerEntryUuid = entryService.entry.ownerEntryUuid;
                        routeParams.ownerInputRef = entryService.entry.ownerInputRef;
                        routeParams.inputRef = entryService.entry.ownerInputRef;
                        routeParams.inputIndex = projectModel.getInputIndexFromRef(entryService.entry.formRef, routeParams.inputRef);
                        routeParams.isBranch = false;
                    }
                }
                break;
            case PARAMETERS.ENTRY_ADD:

                // If add, back to relevant starting page
                if (!entryService.entry.isBranch) {
                    routeName = PARAMETERS.ROUTES.PWA_QUIT;
                } else {
                    //remote or local branch?
                    if (rootStore.branchEditType === PARAMETERS.PWA_BRANCH_REMOTE) {
                        //exit back to dataviewer
                        routeName = PARAMETERS.ROUTES.PWA_QUIT;
                    }
                    else {
                        //local branch, back to entriesAdd component
                        if (rootStore.providedSegment === PARAMETERS.PWA_EDIT_ENTRY) {

                            routeName = PARAMETERS.ROUTES.ENTRIES_EDIT;
                            routeParams.entryUuid = entryService.entry.ownerEntryUuid;

                            //if a child form, it needs extra parameters
                            const hierachyEntry = entryModel;
                            if (hierachyEntry.parentEntryUuid && hierachyEntry.parentFormRef) {
                                //we are going back to a child form
                                routeParams.parentFormRef = hierachyEntry.parentFormRef;
                                routeParams.parentEntryUuid = hierachyEntry.parentEntryUuid;
                            }
                        }
                        else {
                            routeName = PARAMETERS.ROUTES.ENTRIES_ADD;
                        }
                        routeParams.inputRef = entryService.entry.ownerInputRef;
                        routeParams.inputIndex = projectModel.getInputIndexFromRef(entryService.form.formRef, entryService.entry.ownerInputRef);
                        routeParams.isBranch = false;
                    }
                }
                break;
            default:
            //
        }

        return {
            routeName,
            routeParams
        };

    },

    // Returns the navigation route and navigation params
    getNavigationParams (entryService) {

        const rootStore = useRootStore();
        const self = this;
        let routeName = '';
        const routeParams = {
            projectRef: projectModel.getProjectRef(),
            formRef: entryService.entry.formRef
        };

        if (rootStore.isPWA) {
            return self.getNavigationParamsPWA(entryService);
        }

        // Add or edit
        switch (entryService.action) {
            case PARAMETERS.ENTRY_EDIT:
                routeParams.entryUuid = entryService.entry.entryUuid;
                // If edit and native app, we will send user back to view/edit page
                if (!entryService.entry.isBranch) {
                    routeName = PARAMETERS.ROUTES.ENTRIES_VIEW;
                    routeParams.parentEntryUuid = entryService.entry.parentEntryUuid;
                } else {
                    routeName = PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH;
                    routeParams.entryUuid = entryService.entry.entryUuid;
                    routeParams.ownerEntryUuid = entryService.entry.ownerEntryUuid;
                    routeParams.ownerInputRef = entryService.entry.ownerInputRef;
                }
                break;
            case PARAMETERS.ENTRY_UPLOAD:
                // If upload, send user to upload screen
                routeName = PARAMETERS.ROUTES.ENTRIES_UPLOAD;
                break;
            default:
                // If add, back to relevant starting page
                if (!entryService.entry.isBranch) {
                    routeName = PARAMETERS.ROUTES.ENTRIES;
                } else {
                    routeName = PARAMETERS.ROUTES.ENTRIES_ADD;
                    routeParams.inputRef = entryService.entry.ownerInputRef;
                    routeParams.inputIndex = projectModel.getInputIndexFromRef(entryService.form.formRef, entryService.entry.ownerInputRef);
                    routeParams.isBranch = false;
                }
        }

        return {
            routeName,
            routeParams
        };
    }
};

