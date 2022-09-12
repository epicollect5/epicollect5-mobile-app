import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import * as services from '@/services';

// Initial set up for each question
export async function initialSetup (state, scope) {

    //Set up the question details
    function setUpQuestion () {
        state.inputsExtra = projectModel.getExtraInputs();
        state.inputDetails = state.inputsExtra[state.questionParams.currentInputRef].data;
        state.questionParams.type = state.inputDetails.type;
    }
    //Set up answers
    function setUpAnswer () {
        // Retrieve stored answer(s) for this whole entry
        state.answers = scope.entryService.getAnswers(state.questionParams.currentInputRef);
        state.currentAnswer = state.answers[state.questionParams.currentInputRef].answer;

        // Get the confirm answer for this question
        state.confirmAnswer = {};
        state.confirmAnswer[state.questionParams.currentInputRef] = {
            verify: state.inputDetails.verify, // bool
            answer: state.answers[state.questionParams.currentInputRef].answer // answer value
        };

        // Get the confirm answers if the question is a GROUP
        if (state.questionParams.type === PARAMETERS.QUESTION_TYPES.GROUP) {
            scope.entryService.form.formStructure.group[state.questionParams.currentInputRef].forEach((groupInputRef) => {
                state.confirmAnswer[groupInputRef] = {
                    verify: state.inputsExtra[groupInputRef].data.verify, // bool
                    answer: state.answers[groupInputRef].answer // answer value
                };
            });
        }
    }

    // Set up entry/branch entry specific details
    if (state.questionParams.isBranch) {
        //is branch
        scope.entryService = services.branchEntryService;
        state.inputs = scope.entryService.branchInputs;
    } else {
        //is hierarchy
        scope.entryService = services.entryService;
        state.inputs = scope.entryService.form.inputs;
    }
    // If we've been passed currentInputIndex 0, retrieve the first input ref
    if (state.questionParams.currentInputIndex === 0) {
        state.questionParams.currentInputRef = state.inputs[state.questionParams.currentInputIndex];
    }
    // If we have a current input ref
    if (state.questionParams.currentInputRef !== null) {
        setUpQuestion();
        setUpAnswer();
    }
    // Progress percentage
    state.progress = Math.round(
        (state.questionParams.currentInputIndex / state.inputs.length) * 100
    );
    // If we are at the end of the entry, show save button
    state.showSave = state.questionParams.currentInputRef === null;
    if (state.showSave) {
        state.isFetching = false;
    }
    // Set delay for showing next/previous buttons, to deal with double clicks, for example
    window.setTimeout(function () {
        // If we are at the end of the entry, don't show next button
        state.disableNext =
            state.questionParams.currentInputRef === null || scope.entryService.entry.canEdit === 0;
        // If we are at the start of the entry, don't show previous button
        state.disablePrevious =
            state.questionParams.currentInputIndex === 0 || scope.entryService.entry.canEdit === 0;
    }, PARAMETERS.DELAY_MEDIUM);
}