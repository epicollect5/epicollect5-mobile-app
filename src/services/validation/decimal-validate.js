import { commonValidate } from '@/services/validation/common-validate';
export const decimalValidate = {

    errors: {},

    //Check a decimal answer is valid
    check (params) {

        const inputDetails = params.input_details;
        const answer = params.answer.answer;

        // Skip empty strings and null
        // (ionic gives null when you try to enter letter by hacking)
        if (answer !== '' && answer !== null) {
            // Check is valid decimal
            if (!this.isDecimal(answer)) {
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

    //todo: have a look at this
    isDecimal (answer) {
        // optional -
        // at least one number [0-9]
        // optional . and 0 or more [0-9] afterwards
        return /^[-]?[0-9]+\.?[0-9]*$/.test(answer);
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
                if (parseFloat(answer) < parseFloat(inputDetails.min)) {
                    return true;
                }
            }

            // Check max not empty
            if (inputDetails.max !== '') {
                // Check answer is not greater than the max
                if (parseFloat(answer) > parseFloat(inputDetails.max)) {
                    return true;
                }
            }
        }
        return false;
    }
};