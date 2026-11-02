import { PARAMETERS } from '@/config';
import { regexService } from '@/services/validation/regex-service';

// Warn once per pattern, as the same pattern is checked for every answer to
// the question. Used for patterns or answers the engine cannot evaluate, and
// for the JavaScript fallback on devices without WASM
const warnedUnusableRegexes = new Set();

export const commonValidate = {

    validators: {},
    errors: {},
    /**
     * Check the answer length isn't too long, according to rules
     * set in the app config file
     */
    answerTooLong (answer, type) {
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type.toUpperCase()];
        if (!maxLength || !answer) {
            return false;
        }
        return (answer.toString().length > maxLength);
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
    async checkRegex (inputDetails, answer) {
        // Check regex is met
        if (inputDetails.regex !== null && inputDetails.regex !== '') {
            // Patterns come from the project definition, authored for PHP/PCRE
            const engineAvailable = await regexService.isAvailable();

            if (engineAvailable) {
                let matched;
                try {
                    matched = await regexService.test(inputDetails.regex, answer);
                } catch (error) {
                    // The pattern cannot be evaluated here (malformed definition,
                    // or a match limit was hit): never block the answer over it
                    this.warnUnusableRegex(inputDetails, error.message);
                    return true;
                }
                if (matched === false) {
                    this.errors[inputDetails.ref] = ['ec5_23'];
                    return false;
                }
                return true;
            }

            // WASM unavailable (unsupported WebView): JavaScript cannot stand in
            // for PCRE, so the constraint is skipped rather than enforced
            // against text the pattern was never written for
            this.warnUnusableRegex(inputDetails, 'PCRE2 engine unavailable');
            return true;
        }
        return true;
    },

    warnUnusableRegex (inputDetails, message) {
        if (warnedUnusableRegexes.has(inputDetails.regex)) {
            return;
        }
        warnedUnusableRegexes.add(inputDetails.regex);
        console.warn('Ignoring unusable regex for input ' + inputDetails.ref + ': ' + inputDetails.regex + ' (' + message + ')');
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
    },
    isValidUuid (uuid) {
        const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
        return regexExp.test(uuid);
    }
};





