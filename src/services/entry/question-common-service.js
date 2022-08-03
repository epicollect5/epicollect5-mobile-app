import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { toRaw } from '@vue/reactivity';

export const questionCommonService = {
    //Add common params to the input state
    setUpInputParams (state, inputRef, entriesAddState) {

        // Question input details
        const inputsExtra = projectModel.getExtraInputs();
        state.inputDetails = inputsExtra[inputRef].data;

        // Current input ref
        state.currentInputRef = inputRef;
        // Check if any errors
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

    // Returns the navigation route and navigation params
    getNavigationParams (entryService) {

        let routeName;
        const routeParams = {
            projectRef: projectModel.getProjectRef(),
            formRef: entryService.entry.formRef
        };

        // Add or edit
        switch (entryService.actionState) {
            case PARAMETERS.ENTRY_EDIT:
                // If edit, we will send user back to view/edit page
                routeParams.entryUuid = entryService.entry.entryUuid;

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

