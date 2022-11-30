import { PARAMETERS } from '@/config';
import { initialSetup } from '@/use/questions/initial-setup';
import { errorsService } from '@/services/errors-service';

// Initial set up for each question
export async function handleNext (state, scope) {

    // Disable next/previous buttons
    state.disableNext = true;
    state.disablePrevious = true;
    // Nullify type to remove current directive
    state.questionParams.type = null;
    state.isFetching = true;

    // Remove flag that helps to handle back button when user is just dismissing barcode scanner
    //todo: put this in vuex
    window.localStorage.removeItem('is_dismissing_barcode');

    // Validate and save answer
    // Pass in custom object with relevant params

    const inputRef = state.questionParams.currentInputRef;


    try {
        await scope.entryService.validateAnswer({
            // The current answer
            existingAnswer: state.existingAnswer,
            // Send in all answers
            answers: state.answers,
            // And all verified answers
            confirmAnswer: state.confirmAnswer,
            // Send in the main input details
            mainInputDetails: state.inputDetails,
            // And the current error object
            error: state.error
        });
        // Answer passed validation and was successfully stored
        // Check for jumps, retrieving the next:inputRef and nextInputIndex
        const jumpParams = scope.entryService.processJumpsNext(
            state.answers[inputRef],
            state.inputDetails,
            state.questionParams.currentInputIndex
        );
        // Set timeout to give rendering time to catch up
        window.setTimeout(() => {

            //has a jump question been modified?
            //if so, force user to the end of the form
            //for consistency, as the new form flow must be completed
            if (
                scope.entryService.wasJumpEdited({
                    existingAnswer: state.existingAnswer,
                    mainInputDetails: state.inputDetails
                })
            ) {
                //if so, user must reach end of form/branch to save as the flow has changed
                scope.entryService.allowSave = false;
            }

            // Go to next question
            state.questionParams.currentInputRef = jumpParams.next_input_ref;
            state.questionParams.currentInputIndex = jumpParams.next_input_index;
            // Set up next question
            initialSetup(state, scope);
        }, PARAMETERS.DELAY_SHORT);
    } catch (error) {
        console.log(error);
        // Set timeout to give rendering time to catch up
        window.setTimeout(() => {
            // Re enable next/previous buttons if error
            state.disableNext = false;
            state.disablePrevious = false;
            // Set current type back
            state.questionParams.type = state.inputDetails.type;
            errorsService.handleEntryErrors(error.error, state.error, error.inputRefs);
        }, PARAMETERS.DELAY_SHORT);
    }
}