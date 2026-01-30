import {PARAMETERS} from '@/config';
import {projectModel} from '@/models/project-model.js';
import {STRINGS} from '@/config/strings';
import {notificationService} from '@/services/notification-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {answerService} from '@/services/entry/answer-service';
import {utilsService} from '@/services/utilities/utils-service';

export async function fetchBranchAnswers (state, language, labels) {

    async function _addAnswerToItems(inputDetails, index) {
        let error = '';
        let scopeError;
        let groupIndex;
        let group;
        let groupInputDetails;
        let answer = '';

        switch (inputDetails.type) {
            case PARAMETERS.QUESTION_TYPES.GROUP:
                // Loop round group inputs
                answer = {};
                // Add group answers to main group
                group = projectModel.getFormGroups(state.entry.formRef);
                for (groupIndex = 0; groupIndex < group[inputDetails.ref].length; groupIndex++) {
                    groupInputDetails = state.inputsExtra[group[inputDetails.ref][groupIndex]].data;

                    error = '';
                    // Check for synced errors on group input
                    if (state.errors.errors) {
                        // Check if this input has an error
                        for (scopeError in state.errors.errors) {
                            if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
                                if (state.errors.errors[scopeError].source === groupInputDetails.ref) {
                                    // Get translated error code or, if it doesn't exist, server translation from 'title'
                                    error =
                                        STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                                        state.errors.errors[scopeError].title;
                                }

                                //get media errors for the group if any
                                if (
                                    state.errors.errors[scopeError].code === 'ec5_231' &&
                                    state.errors.errors[scopeError].inputRef
                                ) {
                                    if (state.errors.errors[scopeError].inputRef === groupInputDetails.ref) {
                                        error =
                                            STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                                            state.errors.errors[scopeError].title;
                                    }
                                }
                            }
                        }
                    }

                    //filter out README type when the entry is remote as we do not have a remote answer for it
                    if (
                        !(
                            groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README &&
                            state.entry.isRemote === 1
                        )
                    ) {
                        answer[groupInputDetails.ref] = {
                            type: groupInputDetails.type,
                            question:
                                groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README
                                    ? utilsService.htmlDecode(groupInputDetails.question)
                                    : groupInputDetails.question,
                            answer: _getAnswer(
                                groupInputDetails,
                                state.entry.answers[groupInputDetails.ref].answer
                            ),
                            synced_error: error
                        };
                    }
                }

                _renderErrors();
                _renderAnswers();
                break;
            case PARAMETERS.QUESTION_TYPES.BRANCH: {
                // Get number of branches for this input
                //also find if there are media errors for this branch

                answer = _getAnswer(inputDetails, state.branches);

                //any media errors on branches?
                const branchMediaErrors = databaseSelectService.countCurrentBranchMediaErrors(inputDetails.ref);

                //set up generic branch error
                const branch_synced_error = {
                    errors: [
                        {
                            code: 'ec5_231',
                            title: STRINGS[language].entries_errors,
                            source: inputDetails.ref
                        }
                    ]
                };

                //set branch entry media error( to show bug icon next to branch input)
                state.branchesMediaErrors[inputDetails.ref] = branchMediaErrors.rows.item(0).total > 0;

                //add generic media error so it appears at the top in the view
                if (state.branchesMediaErrors[inputDetails.ref]) {
                    if (Object.keys(state.errors).length === 0) {
                        state.errors = branch_synced_error;
                    } else {
                        state.errors.errors = state.errors.errors.concat(branch_synced_error);
                    }
                }
                _renderErrors();
                _renderAnswers();
                break;
            }
            default:
                // Default show answer
                answer = _getAnswer(inputDetails, state.entry.answers[inputDetails.ref].answer);
                _renderErrors();
                _renderAnswers();
        }

        //Get answer for viewing via the AnswerService

        function _getAnswer(inputDetails, answer) {
            return answerService.parseAnswerForViewing(inputDetails, answer);
        }

        function _renderErrors() {
            // Check for synced errors on main input
            if (state.errors.errors) {
                // Check if this input has an error
                for (scopeError in state.errors.errors) {
                    if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
                        if (state.errors.errors[scopeError].source === inputDetails.ref) {
                            // Get translated error code or, if it doesn't exist, server translation from 'title'
                            error =
                                STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                                state.errors.errors[scopeError].title;
                        }

                        //show error on media question (input) if any
                        if (state.errors.errors[scopeError].inputRef) {
                            if (state.errors.errors[scopeError].inputRef === inputDetails.ref) {
                                // Get translated error code or, if it doesn't exist, server translation from 'title'
                                error =
                                    STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                                    state.errors.errors[scopeError].title;
                            }
                        }
                    }
                }
            }
        }

        function _renderAnswers() {
            state.items[inputDetails.ref] = {
                question:
                    inputDetails.type === PARAMETERS.QUESTION_TYPES.README
                        ? utilsService.htmlDecode(inputDetails.question)
                        : inputDetails.question,
                answer: answer,
                possible_answers:
                    inputDetails.possible_answers.length > 0 ? inputDetails.possible_answers : null,
                input_ref: inputDetails.ref,
                input_index: index,
                type: inputDetails.type,
                synced_error: error,
                can_edit: state.entry.canEdit
            };
        }
    }

    let data;
    let inputDetails;

    // Show loader
    await notificationService.showProgressDialog(labels.wait, labels.loading_entry);

    return Promise.all([
        databaseSelectService.selectBranchEntry(state.entryUuid),
        databaseSelectService.selectEntryMediaErrors([state.entryUuid])
    ]).then((response) => {
        const res = response[0];
        const mediaRes = response[1];
        let mediaErrors = [];
        let mediaError;

        //grab media errors if any
        for (let index = 0; index < mediaRes.rows.length; index++) {
            mediaError = JSON.parse(mediaRes.rows.item(index).synced_error);
            //media error is an array of errors
            mediaError.errors.forEach((error) => {
                error.inputRef = mediaRes.rows.item(index).input_ref;
                mediaErrors = mediaErrors.concat(error);
            });
        }

        try {
            if (res.rows.length > 0) {
                // Initialize the entry model
                data = res.rows.item(res.rows.length - 1);
                state.entry.initialise(data);
                state.title = state.entry.title;
                state.synced = state.entry.synced;
            }
            state.errors = JSON.parse(data.synced_error);
            //add media errors (if any)
            state.errors.errors = state.errors.errors.concat(mediaErrors);
        } catch (e) {
            state.errors = {};
            //add media errors (if any)
            if (mediaErrors.length > 0) {
                state.errors.errors = mediaErrors;
            }
        }

        // Now loop round all inputs and display questions and answers
        Object.values(state.branchInputs).forEach((value, index) => {
            inputDetails = state.inputsExtra[value].data;

            // Check we have an answer for this question
            if (typeof state.entry.answers[inputDetails.ref] !== 'undefined') {
                // If the question wasn't jumped, add to items array
                if (!state.entry.answers[inputDetails.ref].was_jumped) {
                    _addAnswerToItems(inputDetails, index);
                }
            }
        });

        // Hide loader
        notificationService.hideProgressDialog();
        state.isFetching = false;
    });
}
