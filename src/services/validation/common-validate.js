import { PARAMETERS } from '@/config';

export const commonValidate = {

    validators: {},
    errors: {},
    /**
     * Check the answer length isn't too long, according to rules
     * set in the app config file
     */
    answerTooLong (answer, type) {
        const typeString = type.toUpperCase();

        if (answer !== null &&
            typeof answer !== 'undefined' &&
            typeof PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[typeString] !== 'undefined') {

            return (answer.toString().length > PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[typeString]);
        }
        return false;
    },
    // Check that the answer matches one of the possible answers
    possibleAnswerNotMatched (answer, inputDetails) {

        // Default noMatch = true
        let noMatch = true;
        let possibleAnswer;

        if (inputDetails.possible_answers.length > 0) {

            // Loop over each possible answer
            for (possibleAnswer in inputDetails.possible_answers) {
                if (Object.prototype.hasOwnProperty.call(inputDetails.possible_answers, possibleAnswer)) {
                    // If we have a match, set match = true
                    if (inputDetails.possible_answers[possibleAnswer].answer_ref === answer) {
                        noMatch = false;
                    }
                }
            }
        }
        return noMatch;
    },
    setValidators (validators) {
        this.validators = validators;
    },
    getErrors () {
        return this.errors;
    },
    hasErrors () {
        return Object.keys(this.errors).length > 0;
    },
    resetErrors () {
        this.errors = {};
    },
    /**
     * Make input type specific answer checks
     */
    answerChecks (params) {

        let result = true;

        // Retrieve validator based on input type
        const validator = this.validators[params.input_details.type];

        // If we have a validator for this input type, run checks
        if (validator) {
            // Reset validator errors
            validator.errors = {};
            // Check for new errors
            result = validator.check(params);
            if (!result) {
                this.errors = validator.errors;
            }
        }
        return result;
    },

    //Check whether answer is required
    checkRequired (inputDetails, answer) {

        if (inputDetails.is_required === true) {
            // Check against all empty answer types
            if (answer === '' || answer === null || typeof answer === 'undefined' || (Array.isArray(answer) && answer.length === 0)) {
                this.errors[inputDetails.ref] = ['ec5_21'];
                return false;
            }
        }
        return true;
    },

    //Check the regular expression
    checkRegex (inputDetails, answer) {
        // Check regex is met
        if (inputDetails.regex !== null && inputDetails.regex !== '') {
            const re = new RegExp(inputDetails.regex);
            if (re.test(answer) === false) {
                this.errors[inputDetails.ref] = ['ec5_23'];
                return false;
            }
        }
        return true;
    },
    // Check confirmed field
    checkConfirmed (inputDetails, answer, confirmAnswer) {


        //imp: do a loosy comparison for integer and decimal
        //imp: as we cannot figure out why sometimes answer values are strings
        //imp: despite using .number in the model
        switch (inputDetails.type) {
            case PARAMETERS.QUESTION_TYPES.INTEGER:
            case PARAMETERS.QUESTION_TYPES.DECIMAL:
                if (answer != confirmAnswer) {// <- mind the "!="
                    this.errors[inputDetails.ref] = ['ec5_124'];
                    return false;
                }
                break;

            default:
                if (answer !== confirmAnswer) {
                    this.errors[inputDetails.ref] = ['ec5_124'];
                    return false;
                }
        }
        return true;
    }
};





