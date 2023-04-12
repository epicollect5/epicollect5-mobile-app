import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';
import { answerValidateService } from '@/services/validation/answer-validate-service';
import { useRootStore } from '@/stores/root-store';
import { databaseSelectService } from '@/services/database/database-select-service';
import { webService } from '@/services/web-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';

export const answerService = {

    //todo: check this this references!!!
    //imp:

    //Start the process of validating and retrieving an answer for an entry
    validateAnswer (entry, params) {
        return new Promise((resolve, reject) => {
            this.validateAndRetrieveAnswer(entry, params).then(function (response) {
                // Reset errors for the input refs handed back in the response
                errorsService.resetEntryErrors(params.error, response.inputRefs);
                resolve();
            }, function (error) {
                reject({ error: error.error, inputRefs: error.inputRefs });
            });
        });
    },

    /**
     * Returns the original entry object, with the 'title' and 'answers' object
     * The 'params' object contains values to validate
     */
    validateAndRetrieveAnswer (entry, params) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const answers = params.answers;
        const confirmAnswer = params.confirmAnswer;
        const mainInput = params.mainInputDetails;
        let i;
        const promises = [];
        const inputsExtra = projectModel.getExtraInputs();

        // Keep track of all input refs being checked
        const inputRefs = [];

        return new Promise((resolve, reject) => {

            // Validate the answer(s)
            // If we have a group, loop through all group inputs/answers
            if (mainInput.type === PARAMETERS.QUESTION_TYPES.GROUP) {

                const group = projectModel.getFormGroups(entry.formRef);

                group[mainInput.ref].forEach((value) => {

                    const groupInputDetails = inputsExtra[value].data;
                    // Create params object
                    const groupParams = {
                        input_details: groupInputDetails,
                        answer: answers[groupInputDetails.ref],
                        //todo: could be groupInputDetails.verify ? ... : ...
                        confirmAnswer: confirmAnswer ? confirmAnswer[groupInputDetails.ref] : {}
                    };
                    // Validate each group answer
                    promises.push(this.validate(entry, groupParams));
                    // Track input ref
                    inputRefs.push(groupInputDetails.ref);
                });
            }

            // Validate main answer
            promises.push(this.validate(entry, {
                input_details: mainInput,
                answer: answers[mainInput.ref],
                //todo: could be mainInput.verify ? ... : ...
                confirmAnswer: confirmAnswer ? confirmAnswer[mainInput.ref] : {}
            }));
            // Track input ref
            inputRefs.push(mainInput.ref);

            // When all promises resolve, process further
            Promise.all(promises).then((responseParams) => {
                // Loop round all returned input details objects (including main inputs, group inputs etc)
                for (i = 0; i < responseParams.length; i++) {
                    this.checkUniqueness(entry, responseParams[i].input_details, responseParams[i].answer.answer);
                    // Store the answer after a final parsing
                    entry.answers[responseParams[i].input_details.ref] = this.parseAnswer(responseParams[i].answer);
                }
                // Resolve with each input ref that was actioned
                resolve({ inputRefs: inputRefs });
            }, function (errors) {
                // Or error out, returning specific errors
                const error = {};

                // If we have errors, notify user
                for (const err in errors) {
                    if (Object.prototype.hasOwnProperty.call(errors, err)) {
                        // Add first error to error object
                        error[err] = {
                            message: STRINGS[language].status_codes[errors[err]]
                        };
                        // Break after first error
                        break;
                    }
                }
                // If we get a single rejection, reject with errors

                reject({ error: error, inputRefs: inputRefs });
            });
        });
    },

    // Validate an answer
    validate (entry, params) {

        // Validate answer against the input
        return new Promise((resolve, reject) => {

            answerValidateService.validate(entry, params).then(function () {
                // Resolve with the particular input details of the input supplied
                resolve(params);
            }, function (error) {
                if (error) {
                    //here we probably got a database error
                    console.log(error);
                    const inputRef = params.input_details.ref;
                    answerValidateService.errors[inputRef] = ['ec5_104'];
                }

                // Check whether answer is valid
                const errors = answerValidateService.getErrors();
                // Reject if we have errors
                reject(errors);
            });
        });
    },

    parseAnswerForViewing (inputDetails, answer) {

        const rootStore = useRootStore();
        const language = rootStore.language;

        switch (inputDetails.type) {
            //radio and dropdown answers are string
            case PARAMETERS.QUESTION_TYPES.RADIO:
            case PARAMETERS.QUESTION_TYPES.DROPDOWN:
                inputDetails.possible_answers.forEach((value, index) => {
                    if (answer === value.answer_ref) {
                        answer = inputDetails.possible_answers[index].answer;
                    }
                });
                break;
            //checkbox and search are array
            case PARAMETERS.QUESTION_TYPES.CHECKBOX:
            case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
            case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE: {
                const answers = [];
                inputDetails.possible_answers.forEach((value, index) => {
                    if (answer.indexOf(value.answer_ref) > -1) {
                        answers.push(inputDetails.possible_answers[index].answer);
                    }
                });
                answer = answers.join(', ');
                break;
            }
            case PARAMETERS.QUESTION_TYPES.AUDIO:
                answer = (answer !== '') ? STRINGS[language].labels.file_available : ' ';
                break;
            case PARAMETERS.QUESTION_TYPES.PHOTO:
                answer = (answer !== '') ? STRINGS[language].labels.file_available : ' ';
                break;
            case PARAMETERS.QUESTION_TYPES.VIDEO:
                answer = (answer !== '') ? STRINGS[language].labels.file_available : ' ';
                break;
            case PARAMETERS.QUESTION_TYPES.TIME:
                answer = answer ? utilsService.getUserFormattedTime(answer, inputDetails.datetime_format) : ' ';
                break;
            case PARAMETERS.QUESTION_TYPES.DATE:
                answer = answer ? utilsService.getUserFormattedDate(answer, inputDetails.datetime_format) : ' ';
                break;
            case PARAMETERS.QUESTION_TYPES.BRANCH:
                if (answer[inputDetails.ref]) {
                    answer = answer[inputDetails.ref] + ' ' + (answer[inputDetails.ref] > 1 ? STRINGS[language].labels.entries : STRINGS[language].labels.entry);
                } else {
                    answer = '0 ' + STRINGS[language].labels.entries;
                }
                break;
        }
        return answer;
    },
    // Generate a default answer
    generateAnswer (entry, inputRef) {

        const rootStore = useRootStore();
        const inputsExtra = projectModel.getExtraInputs();
        const inputDetails = inputsExtra[inputRef].data;

        // Add answer
        entry.answers[inputDetails.ref] = this.createDefaultAnswer(inputDetails);

        if (inputDetails.type === PARAMETERS.QUESTION_TYPES.GROUP) {
            // Add group answers to main group
            const group = projectModel.getFormGroups(entry.formRef);
            for (let j = 0; j < group[inputDetails.ref].length; j++) {
                const groupInputDetails = inputsExtra[group[inputDetails.ref][j]].data;

                if (rootStore.isPWA) {
                    //check if there is an existing answer for this group question already
                    //happens when old entries are edited on the pwa
                    //todo:could also check for action ENTRY_EDIT

                    //imp: we do this here because when editing entries on the PWA, the group question ref
                    //is missing from the response but it is needed by the app logic to show existing answers
                    //in group questions
                    if (!entry.answers[groupInputDetails.ref]) {
                        entry.answers[groupInputDetails.ref] = this.createDefaultAnswer(groupInputDetails);
                    }
                }
                else {
                    entry.answers[groupInputDetails.ref] = this.createDefaultAnswer(groupInputDetails);
                }
            }
        }
    },
    // Create default set of answers
    createDefaultAnswer (inputDetails) {

        const answer = { was_jumped: false };
        let defaultAnswer;
        let i;

        switch (inputDetails.type) {

            case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
            case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE:
            case PARAMETERS.QUESTION_TYPES.CHECKBOX:

                defaultAnswer = [];
                // Check if we have a 'default' answer in the input details i.e. not an empty string
                if (inputDetails.default !== '') {
                    // Check that this default answer is a valid possible answer
                    for (i = 0; i < inputDetails.possible_answers.length; i++) {
                        if (inputDetails.default === inputDetails.possible_answers[i].answer_ref) {
                            defaultAnswer = [inputDetails.default];
                        }
                    }
                }
                answer.answer = defaultAnswer;
                break;
            case PARAMETERS.QUESTION_TYPES.RADIO:
            case PARAMETERS.QUESTION_TYPES.DROPDOWN:

                defaultAnswer = '';
                // Check if we have a 'default' answer in the input details i.e. not an empty string
                if (inputDetails.default !== '') {
                    // Check that this default answer is a valid possible answer
                    for (i = 0; i < inputDetails.possible_answers.length; i++) {
                        if (inputDetails.default === inputDetails.possible_answers[i].answer_ref) {
                            defaultAnswer = inputDetails.default;
                        }
                    }
                }
                answer.answer = defaultAnswer;
                break;
            case PARAMETERS.QUESTION_TYPES.LOCATION:
                answer.answer = {
                    latitude: '',
                    longitude: '',
                    accuracy: ''
                };
                break;
            default:
                // Check if we have a 'default' answer in the input details
                defaultAnswer = '';
                if (inputDetails.default !== null && inputDetails.default !== '') {
                    defaultAnswer = inputDetails.default;
                }
                answer.answer = defaultAnswer;
        }
        return answer;
    },
    // Check for uniqueness and add to entry uniqueAnswers object
    checkUniqueness (entry, inputDetails, answer) {

        if (inputDetails.uniqueness !== 'none' && answer !== '') {
            // Lowercase the actual answer (if string)
            entry.uniqueAnswers[inputDetails.ref] = (typeof answer === 'string' ? answer.toLowerCase() : answer);
        }
    },
    /**
     * A final parsing of answers, to check not undefined
     * i.e. if a decimal/integer input is changed to type text, answer will be undefined
     * Also default was_jumped to false
     */
    parseAnswer (answer) {

        // If we have any undefined or null answers, default to empty string
        if (answer === null || typeof answer === 'undefined' || typeof answer.answer === 'undefined' || answer.answer === null) {
            answer.answer = '';
        }

        // Default was_jumped to false, as this question was not jumped (but may previously have been)
        answer.was_jumped = false;

        return answer;
    },

    getAnswersTitles (entry, inputs, group, inputList, parseAnswerForViewing) {

        // Function for parsing answers for viewing
        if (!parseAnswerForViewing) {
            // If we're not supplied a revised function, use module function
            parseAnswerForViewing = this.parseAnswerForViewing;
        }

        const titles = [];
        let answer;
        let groupInputRef;
        let groupIndex;
        let groupInput;
        let inputRef;
        let index;
        let input;

        const getTitles = function (input) {

            switch (input.type) {
                case PARAMETERS.QUESTION_TYPES.GROUP: {
                    // Loop group inputs
                    for (groupIndex = 0; groupIndex < group[input.ref].length; groupIndex++) {
                        groupInputRef = group[input.ref][groupIndex];
                        groupInput = inputList[groupInputRef].data;

                        // Get titles for the group
                        getTitles(groupInput);
                    }
                }
                    break;
                case PARAMETERS.QUESTION_TYPES.README:
                    // readme types have no answer
                    break;
                case PARAMETERS.QUESTION_TYPES.CHECKBOX:
                case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
                case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE:
                    // checkbox types are arrays
                    if (entry.answers[input.ref]) {
                        answer = entry.answers[input.ref].answer;

                        // If we have a title and answer not empty array
                        if (input.is_title && Array.isArray(answer) && answer.length !== 0) {
                            titles.push(parseAnswerForViewing(input, answer));
                        }
                    }
                    break;
                default: {
                    // Default i.e. any other question
                    // Check we have an answer
                    if (entry.answers[input.ref]) {
                        answer = entry.answers[input.ref].answer;

                        // If we have a title
                        if (input.is_title && answer !== '') {
                            titles.push(parseAnswerForViewing(input, answer));
                        }
                    }
                }
            }

        };
        // Loop all the inputs (in order) and pull out the answers for the title
        for (index = 0; index < inputs.length; index++) {
            inputRef = inputs[index];
            input = inputList[inputRef].data;
            // Get titles
            getTitles(input);
        }
        return titles;
    },

    async getSavedAnswers (projectRef, formRef, isBranch, offset, inputRef) {
        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {
            if (rootStore.isPWA) {
                //get answers from server
                //todo: check entries permission and filtering i.e for collectors
                const slug = projectModel.getSlug();
                //get branchRef 
                let branchRef = null;
                if (isBranch) {
                    branchRef = branchEntryService.branchInput.ref;
                }

                webService.fetchSavedAnswersPWA(slug, formRef, branchRef, offset, inputRef).then((response) => {
                    //build result object like web sql so we can re-use the code in the caller
                    const rows = {
                        count: response.data.data.answers.length,
                        entries: response.data.data.answers.map((answer) => {
                            const parsedAnswer = {
                                [inputRef]: {
                                    answer,
                                    was_jumped: false
                                }
                            };
                            return { answers: JSON.stringify(parsedAnswer) };
                        }),
                        get length () {
                            return this.count;
                        },
                        item (index) {
                            return this.entries[index];
                        }
                    };
                    resolve({ rows });
                }, (error) => {
                    console.log(error);
                    reject(error);
                });
            }
            else {
                //get answers from local database
                databaseSelectService.getSavedAnswers(projectRef, formRef, isBranch, offset).then((result) => {
                    resolve(result);
                });
            }
        });
    }
};