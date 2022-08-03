import { commonValidate } from '@/services/validation/common-validate';
export const dropdownValidate = {

    errors: {},
    //Check possible answers for single selection inputs
    check (params) {

        const inputDetails = params.input_details;
        const answer = params.answer.answer;

        // Skip empty strings and null
        // (ionic gives null when you try to hack it)
        if (answer !== '' && answer !== null) {
            if (commonValidate.possibleAnswerNotMatched(answer, inputDetails)) {
                this.errors[inputDetails.ref] = ['ec5_25'];
                return false;
            }
        }
        // Check the answer isn't too long
        if (commonValidate.answerTooLong(answer, inputDetails.type)) {
            this.errors[inputDetails.ref] = ['ec5_214'];
            return false;
        }
        return true;
    }
};
