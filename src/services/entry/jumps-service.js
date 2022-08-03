import { answerService } from '@/services/entry/answer-service';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';


export const jumpsService = {
    /**
     * Get the next input ref
     * Process the jumps
     * @returns {{next_input_ref: *, next_input_index: *}}
     */
    processJumpsNext (entry, answer, inputDetails, nextInputIndex, nextInputRef) {

        let newNextInputIndex = nextInputIndex;

        // Check if we have jumps here
        if (inputDetails.jumps.length > 0) {

            // Update the nextInputRef, if necessary
            nextInputRef = this.getNextInputRef(answer.answer, inputDetails, nextInputRef);

            // Retrieve the index for this updated nextInputRef
            newNextInputIndex = this.getInputIndexFromRef(entry, nextInputRef);

            // If there is a difference, we are going to jump questions
            if (nextInputIndex < newNextInputIndex) {
                this.jumpQuestions(entry, nextInputIndex, newNextInputIndex);
            }
        }
        return {
            next_input_ref: nextInputRef,
            next_input_index: newNextInputIndex
        };
    },

    /**
     * Jump questions between the two input indexes
     * Set any answer 'was_jumped' properties to true where necessary
     */
    jumpQuestions (entry, firstInputIndex, secondInputIndex) {

        let currentInput;
        let currentInputRef;
        let i;
        let group;
        let groupInput;


        // Loop through each input in between
        for (firstInputIndex; firstInputIndex < secondInputIndex; firstInputIndex++) {

            // Get this input ref
            currentInputRef = this.getInputRefFromIndex(entry, firstInputIndex);
            currentInput = projectModel.getInput(currentInputRef);

            // Set was_jumped = true for this input ref
            this.setJumped(entry, currentInputRef);

            // If this input is a group, loop each group input and set was_jumped = true
            if (currentInput.type === PARAMETERS.QUESTION_TYPES.GROUP) {
                group = projectModel.getGroupInputs(entry.formRef, currentInputRef);
                for (i = 0; i < group.length; i++) {
                    groupInput = projectModel.getInput(group[i].ref);
                    // Set was_jumped = true for this group input ref
                    this.setJumped(entry, groupInput.ref);
                }
            }
        }
    },

    // Set was_jumped = true
    setJumped (entry, inputRef) {

        // If we don't have an answer for this input ref yet, create one
        if (typeof entry.answers[inputRef] === 'undefined') {
            answerService.generateAnswer(entry, inputRef);
        }
        entry.answers[inputRef].was_jumped = true;
    },

    /**
     * Get the previous input ref
     * Check for previous questions that were jumped
     * @returns {{previous_input_ref: *, previous_input_index: *}}
     */
    processJumpsPrevious (entry, prevInputIndex, inputs) {

        // Retrieve previous input index/ref
        let prevInputRef = inputs[prevInputIndex];

        // While each previous answer was jumped,
        // decrement the index and try again with the associated input ref
        // until we find an input that wasn't jumped
        while (entry.answers[prevInputRef].was_jumped === true) {
            prevInputIndex = prevInputIndex - 1;
            prevInputRef = inputs[prevInputIndex];
        }

        return {
            previous_input_ref: prevInputRef,
            previous_input_index: prevInputIndex
        };
    },

    /**
     * Get the next input ref, if questions are jumped
     */
    getNextInputRef (answer, inputDetails, nextInputRef) {

        let i;

        for (i = 0; i < inputDetails.jumps.length; i++) {

            const currentJump = inputDetails.jumps[i];

            if (this.shouldJump(currentJump, inputDetails, answer)) {
                // If we are jumping to the END of the form, set nextInputRef to null,
                // indicating the end of the form
                return (currentJump.to === PARAMETERS.JUMPS.END_OF_FORM ? null : currentJump.to);
            }
        }
        // If no jumping, return original nextInputRef
        return nextInputRef;
    },

    // Check if an answer meets the criteria to initialise a jump
    shouldJump (currentJump, inputDetails, answer) {

        switch (inputDetails.type) {

            // Treat checkboxes and search differently to other input types,
            // as we can have more than one answer here
            case PARAMETERS.QUESTION_TYPES.CHECKBOX:
            case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
            case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE:

                switch (currentJump.when) {

                    case PARAMETERS.JUMPS.IS:
                        // If the answer matches the jumped answer
                        for (const index in answer) {
                            if (Object.prototype.hasOwnProperty.call(answer, 'index')) {
                                if (answer[index]) {
                                    if (answer[index] === currentJump.answer_ref) {
                                        return true;
                                    }
                                }
                            }
                        }
                        break;
                    case PARAMETERS.JUMPS.IS_NOT:
                        // If the answer doesn't match the jumped answer
                        for (const index in answer) {
                            if (Object.prototype.hasOwnProperty.call(answer, 'index')) {
                                if (answer[index]) {
                                    if (answer[index] === currentJump.answer_ref) {
                                        return false;
                                    }
                                }
                            }
                        }
                        // No answers match jump answer
                        return true;
                    case PARAMETERS.JUMPS.NO_ANSWER_GIVEN:
                        // If no answer
                        for (const index in answer) {
                            if (Object.prototype.hasOwnProperty.call(answer, 'index')) {
                                if (answer[index]) {
                                    return false;
                                }
                            }
                        }
                        // No answers given
                        return true;
                    case PARAMETERS.JUMPS.ALL:
                        // Always jump
                        return true;
                }
                break;
            default:
                // Every other input types
                switch (currentJump.when) {
                    case PARAMETERS.JUMPS.IS:
                        // If the answer matches the jumped answer
                        if (answer === currentJump.answer_ref) {
                            return true;
                        }
                        break;
                    case PARAMETERS.JUMPS.IS_NOT:
                        // If the answer doesn't match the jumped answer
                        if (answer !== currentJump.answer_ref) {
                            return true;
                        }
                        break;
                    case PARAMETERS.JUMPS.NO_ANSWER_GIVEN:
                        // If no answer
                        if (answer === '') {
                            return true;
                        }
                        break;
                    case PARAMETERS.JUMPS.ALL:
                        // Always jump
                        return true;
                }
        }
        return false;
    },

    getInputIndexFromRef (entry, inputRef) {

        if (!entry.isBranch) {
            return projectModel.getInputIndexFromRef(entry.formRef, inputRef);
        } else {
            return projectModel.getBranchInputIndexFromRef(entry.formRef, entry.ownerInputRef, inputRef);
        }
    },

    getInputRefFromIndex (entry, inputIndex) {

        if (!entry.isBranch) {
            return projectModel.getInputRefFromIndex(entry.formRef, inputIndex);
        } else {
            return projectModel.getBranchInputRefFromIndex(entry.formRef, entry.ownerInputRef, inputIndex);
        }
    }
};