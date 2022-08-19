import { commonValidate } from '@/services/validation/common-validate';
export const barcodeValidate = {

    errors: {},
    check (params) {
        const inputDetails = params.input_details;
        const answer = params.answer.answer;

        // Check the answer isn't too long
        if (commonValidate.answerTooLong(answer, inputDetails.type)) {
            this.errors[inputDetails.ref] = ['ec5_214'];
            return false;
        }

        return true;
    }
};