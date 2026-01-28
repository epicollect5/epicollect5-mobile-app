import {notificationService} from '@/services/notification-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {answerService} from '@/services/entry/answer-service';
import {utilsService} from '@/services/utilities/utils-service';
import {projectModel} from '@/models/project-model.js';
import {STRINGS} from '@/config/strings';
import {PARAMETERS} from '@/config';


export async function fetchAnswers(state, language, labels) {
    let branchIndex;
    let data;
    let inputDetails;

    // Show loader
    await notificationService.showProgressDialog(labels.wait, labels.loading_entry);

    Promise.all([
        databaseSelectService.selectEntry(state.entryUuid, state.parentEntryUuid),
        databaseSelectService.selectEntryMediaErrors([state.entryUuid])
    ]).then(function (response) {
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
                data = res.rows.item(0);
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

        // Retrieve branch entries
        databaseSelectService.selectBranches([state.entry.entryUuid]).then(function (res) {
            //reset branches counts
            state.branches = {};
            // Loop round branches, counting
            for (branchIndex = 0; branchIndex < res.rows.length; branchIndex++) {
                // Increment number of branches for this input ref
                if (!state.branches[res.rows.item(branchIndex).owner_input_ref]) {
                    state.branches[res.rows.item(branchIndex).owner_input_ref] = 1;
                } else {
                    state.branches[res.rows.item(branchIndex).owner_input_ref]++;
                }
            }

            // Now loop round all inputs and display questions and answers
            state.inputs.forEach((value, index) => {
                inputDetails = state.inputsExtra[value].data;

                // Check we have an answer for this question
                if (typeof state.entry.answers[inputDetails.ref] !== 'undefined') {
                    // If the question wasn't jumped, add to items array
                    if (!state.entry.answers[inputDetails.ref].was_jumped) {
                        _addAnswerToItems(state,inputDetails, index, language);
                    }
                }

                //For remote entries, rebuild group nested structure
                if (state.entry.isRemote === 1) {
                    //remote entries are flatted out on the server, so check if this input is a group
                    if (inputDetails.type === PARAMETERS.QUESTION_TYPES.GROUP) {
                        //add to item array
                        _addAnswerToItems(state,inputDetails, index, language);
                    }
                }
            });

            state.isFetching = false;
            setTimeout(() => {
                notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
            }, PARAMETERS.DELAY_LONG);
        });
    });
}

function _addAnswerToItems(state, inputDetails, index, language) {
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
        case PARAMETERS.QUESTION_TYPES.BRANCH:
            // Get number of branches for this input
            //also find if there are media errors for this branch

            answer = _getAnswer(inputDetails, state.branches);

            //any media errors on branches?
            databaseSelectService
                .countCurrentBranchMediaErrors(inputDetails.ref)
                .then(function (response) {
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
                    state.branchesMediaErrors[inputDetails.ref] = response.rows.item(0).total > 0;

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
                });
            break;
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

    //get markup to show project logo in page header
    state.projectName = utilsService.getProjectNameMarkup();
}
