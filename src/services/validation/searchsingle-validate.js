import { commonValidate } from '@/services/validation/common-validate';
export const searchsingleValidate = {

    errors: {},
    //Check possible answers for single selection inputs
    check (params) {

        const inputDetails = params.input_details;
        const answers = [...params.answer.answer];
        let valid = true;

        //search single can have at most 1 answer
        if (answers.length > 1) {
            // "ec5_340": "Too many possible answers!",
            this.errors[inputDetails.ref] = ['ec5_340'];
            return false;
        }

        answers.forEach((answer) => {
            if (valid) {
                // Skip empty strings and null
                // (ionic gives null when you try to hack it)
                if (answer !== '' && answer !== null) {
                    if (commonValidate.possibleAnswerNotMatched(answer, inputDetails)) {
                        this.errors[inputDetails.ref] = ['ec5_25'];
                        valid = false;
                    }
                }
                // Check the answer isn't too long
                if (commonValidate.answerTooLong(answer, inputDetails.type)) {
                    this.errors[inputDetails.ref] = ['ec5_214'];
                    valid = false;
                }
            }

        });
        return valid;
    }
};
