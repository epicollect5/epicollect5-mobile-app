import { answerService } from '@/services/entry/answer-service';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { locationService } from '@/services/utilities/location-cordova-service';
import { errorsService } from '@/services/errors-service';
import { jumpsService } from '@/services/entry/jumps-service';

export const entryCommonService = {
    /**
     * Add default answers for all questions in entry
     */
    addDefaultAnswers (entry, inputs) {

        // Loop round and pre populate the answers for each question
        for (let i = 0; i < inputs.length; i++) {

            const inputsExtra = projectModel.getExtraInputs();
            const inputDetails = inputsExtra[inputs[i]].data;

            // Add answer
            entry.answers[inputDetails.ref] = answerService.createDefaultAnswer(inputDetails);

            if (inputDetails.type === PARAMETERS.QUESTION_TYPES.GROUP) {
                // Add group answers to main group
                const group = projectModel.getFormGroups(entry.formRef);
                for (let j = 0; j < group[inputDetails.ref].length; j++) {
                    const groupInputDetails = inputsExtra[group[inputDetails.ref][j]].data;
                    // Add answer
                    entry.answers[groupInputDetails.ref] = answerService.createDefaultAnswer(groupInputDetails);
                }
            }
        }
    },

    /**
     * Add fake answers for all questions in entry
     */
    async addFakeAnswers (entry, inputs, entryIndex) {

        const { fakeAnswerService } = await import('@/services/entry/fake-answer-service');

        return new Promise((resolve, reject) => {
            //stop location
            locationService.stopWatching();

            _addSingleInputAnswer(inputs.shift());

            function _addSingleInputAnswer (question) {

                const inputsExtra = projectModel.getExtraInputs();
                const inputDetails = inputsExtra[question].data;

                // Add answer
                fakeAnswerService.createFakeAnswer(inputDetails, entry, entryIndex)
                    .then(function (answer) {
                        console.log('saving with ref ' + inputDetails.ref + ' answer ' + JSON.stringify(answer));
                        entry.answers[inputDetails.ref] = answer;

                        let group;
                        let groupInputs;

                        function _addGroupInputFakeAnswer (groupInput) {
                            const groupInputDetails = inputsExtra[groupInput].data;
                            // Add answer to group input
                            fakeAnswerService.createFakeAnswer(groupInputDetails, entry, entryIndex).then(function (answer) {
                                entry.answers[groupInputDetails.ref] = answer;

                                if (groupInputs.length > 0) {
                                    _addGroupInputFakeAnswer(groupInputs.shift());
                                }
                                else {
                                    //do we have another question?
                                    if (inputs.length > 0) {
                                        _addSingleInputAnswer(inputs.shift());
                                    }
                                    else {
                                        resolve();
                                    }
                                }
                            });
                        }

                        //are there any groups?
                        if (inputDetails.type === PARAMETERS.QUESTION_TYPES.GROUP) {
                            // Add group answers to main group
                            group = projectModel.getFormGroups(entry.formRef);
                            // get a copy of group inputs with slice(0))
                            groupInputs = group[inputDetails.ref].slice(0);

                            _addGroupInputFakeAnswer(groupInputs.shift());
                        } else {
                            //do we have another question?
                            if (inputs.length > 0) {
                                _addSingleInputAnswer(inputs.shift());
                            }
                            else {
                                resolve();
                            }
                        }
                    });
            }
        });
    },

    /**
     * Return current answers object
     * Populate answer for given input ref, if it doesn't exist
     */
    getAnswers (entry, inputRef) {
        // If we don't have an answer for this input ref yet, create one
        if (typeof entry.answers[inputRef] === 'undefined') {
            answerService.generateAnswer(entry, inputRef);
        }
        return entry.answers;
    },

    // Validate and append answer/title to entry object
    validateAnswer (entry, params) {

        return new Promise((resolve, reject) => {
            answerService.validateAndRetrieveAnswer(entry, params).then(function (response) {
                // Reset errors

                errorsService.resetEntryErrors(params.error, response.inputRefs);
                resolve();
            }, function (error) {

                reject({ error: error.error, inputRefs: error.inputRefs });
            });
        });
    },

    // Set the entry title
    setEntryTitle (form, inputs, entry, isBranch) {

        let titles = [];
        // Reset title
        entry.title = '';

        // Form

        if (!isBranch) {
            titles = answerService.getAnswersTitles(entry, form.inputs, form.group, inputs);
        } else {
            // Branch
            titles = answerService.getAnswersTitles(entry, form.branch[entry.ownerInputRef], form.group, inputs);
        }
        // If no title, use uuid
        if (titles.length === 0) {
            entry.title = entry.entryUuid;
        } else {
            entry.title = titles.join(' ');
        }
    },

    /**
     * Get the next input ref
     * Processing any jumps
     */
    processJumpsNext (entry, answer, inputDetails, currentInputIndex, inputs) {
        // Retrieve next input index/ref

        const nextInputIndex = currentInputIndex + 1;
        const nextInputRef = inputs[nextInputIndex] ? inputs[nextInputIndex] : null;

        return jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
    },

    /**
     * Get the previous input ref
     * Check for previous questions that were jumped
     */
    processJumpsPrevious (entry, currentInputIndex, inputs) {
        // Retrieve previous input index
        const prevInputIndex = currentInputIndex - 1;

        return jumpsService.processJumpsPrevious(entry, prevInputIndex, inputs);
    }
};
