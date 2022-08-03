import { PARAMETERS } from '@/config';
import * as services from '@/services';
import { initialSetup } from '@/use/questions/initial-setup';

// Initial set up for each question
export async function handlePrev (state, scope) {
    // PREVIOUS QUESTION
    state.isFetching = true;
    // Disable next/previous buttons
    state.disableNext = true;
    state.disablePrevious = true;
    // Nullify type to remove current directive
    state.questionParams.type = null;

    // Remove flag that helps to handle back button when user is just dismissing barcode scanner
    //todo: to vuex
    //todo:window.localStorage.removeItem('is_dismissing_barcode');

    // Check for jumps, retrieving the prev:inputRef
    const jumpParams = scope.entryService.processJumpsPrevious(
        state.questionParams.currentInputIndex
    );

    // Set timeout to give rendering time to catch up
    setTimeout(function () {
        // Check if allowSave variable has changed
        if (state.allowSave !== services.entryService.allowSave) {
            state.allowSave = services.entryService.allowSave;
        }
        state.questionParams.currentInputRef = jumpParams.previous_input_ref;
        state.questionParams.currentInputIndex = jumpParams.previous_input_index;
        // Set up previous question
        initialSetup(state, scope);
    }, PARAMETERS.DELAY_SHORT);
}