import { commonValidate } from '@/services/validation/common-validate';
export const integerValidate = {

    errors: {},
    //Check an integer answer is valid
    check (params) {

        const inputDetails = params.input_details;
        const answer = params.answer.answer;

        // Skip empty strings and null
        // (ionic gives null when you try to enter letter by hacking)
        if (answer !== '' && answer !== null) {
            // Check is valid integer
            if (!this.isInteger(answer)) {
                this.errors[inputDetails.ref] = ['ec5_29'];
                return false;
            }

            // Check answer against the min and max
            if (this.outOfBounds(answer, inputDetails)) {
                this.errors[inputDetails.ref] = ['ec5_28'];
                return false;
            }
        }

        // Check the answer isn't too long
        if (commonValidate.answerTooLong(answer, inputDetails.type)) {
            this.errors[inputDetails.ref] = ['ec5_214'];
            return false;
        }
        return true;
    },
    //todo: check this
    isInteger (answer) {
        // optional -
        // at least one number 0-9
        return /^[-]?[0-9]+$/.test(answer);
    },

    /**
     * Check if the min and max values are not met
     * (if available)
     */
    outOfBounds (answer, inputDetails) {

        if (!isNaN(answer)) {
            // Check min not empty
            if (inputDetails.min !== '') {
                // Check answer is not less than the min
                if (parseInt(answer) < parseInt(inputDetails.min)) {
                    return true;
                }
            }
            // Check max not empty
            if (inputDetails.max !== '') {
                // Check answer is not greater than the max
                if (parseInt(answer) > parseInt(inputDetails.max)) {
                    return true;
                }
            }

        }
        return false;
    }
};
