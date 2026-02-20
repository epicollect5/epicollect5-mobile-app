import {notificationService} from '@/services/notification-service';
import {errorsService} from '@/services/errors-service';
import {questionCommonService} from '@/services/entry/question-common-service';
import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {projectModel} from '@/models/project-model.js';

export async function saveEntryPWA(state, quit) {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    function showEntrySavedSuccessScreen() {
        state.entrySavedPWA = true;
        state.entryFailedPWA = false;
        state.showSave = false;
        state.showSaved = true;
        state.disablePrevious = true;
        state.disableNext = true;
        notificationService.hideProgressDialog();
    }

    await notificationService.showProgressDialog(labels.wait, labels.saving);
    rootStore.entriesAddScope.entryService.allowSave = true;
    state.action = rootStore.entriesAddScope.entryService.action;

    try {
        await rootStore.entriesAddScope.entryService.saveEntryPWA();
        //if a branch, go back to branch question and update branches list
        if (rootStore.entriesAddScope.entryService.type === PARAMETERS.BRANCH_ENTRY) {
            //if dealing with a remote branch entry, just show the success screen
            if (rootStore.branchEditType === PARAMETERS.PWA_BRANCH_REMOTE) {
                showEntrySavedSuccessScreen();
            } else {
                quit(
                    questionCommonService.getNavigationParams(
                        rootStore.entriesAddScope.entryService
                    )
                );
            }
        } else {
            //this is a hierarchy entry:
            showEntrySavedSuccessScreen();
        }
    } catch (errorResponse) {
        //random server errors bail out
        if (!errorResponse.data?.errors) {
            console.log(errorResponse);
            notificationService.hideProgressDialog();
            await errorsService.handleWebError(errorResponse);
            return false;
        }
        //map input errors to input ref
        const translatedInputErrors = {};
        //add global errors (if any) to store
        const inputsExtra = projectModel.getExtraInputs();

        //errors here have the input_ref as source, map and translate them
        //global errors are saved in the rootStore.queueGlobalUploadErrorsPWA
        errorResponse.data.errors.forEach((error) => {
            const inputRef = error.source;
            if (inputsExtra[inputRef]) {
                //add input errors to inputErrors object
                translatedInputErrors[inputRef] = {
                    message: STRINGS[language].status_codes[error.code],
                    code: error.code
                };
            }
        });

        //cache any errors
        rootStore.routeParams = {
            ...rootStore.routeParams,
            error: {errors: errorResponse.data.errors}
        };
        //set up scope errors
        state.error = {
            errors: translatedInputErrors
        };

        state.entrySavedPWA = false;
        state.entryFailedPWA = true;
        state.showSave = false;
        state.showSaved = true;
        state.disablePrevious = false;
        state.disableNext = true;

        //handle error, users can go back to check for errors
        await errorsService.handleWebError(errorResponse);
        notificationService.hideProgressDialog();
    }
}
