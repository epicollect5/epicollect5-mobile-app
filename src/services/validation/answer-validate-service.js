import { databaseSelectService } from '@/services/database/database-select-service';
import { textValidate } from '@/services/validation/text-validate';
import { dropdownValidate } from '@/services/validation/dropdown-validate';
import { integerValidate } from '@/services/validation/integer-validate';
import { decimalValidate } from '@/services/validation/decimal-validate';
import { radioValidate } from '@/services/validation/radio-validate';
import { dateValidate } from '@/services/validation/date-validate';
import { timeValidate } from '@/services/validation/time-validate';
import { textareaValidate } from '@/services/validation/textarea-validate';
import { phoneValidate } from '@/services/validation/phone-validate';
import { checkboxValidate } from '@/services/validation/checkbox-validate';
import { barcodeValidate } from '@/services/validation/barcode-validate';
import { locationValidate } from '@/services/validation/location-validate';
import { searchsingleValidate } from '@/services/validation/searchsingle-validate';
import { searchmultipleValidate } from '@/services/validation/searchmultiple-validate';
import { commonValidate } from '@/services/validation/common-validate';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';


import { PARAMETERS } from '@/config';

export const answerValidateService = {

    errors: {},
    inputRef: '',

    /**
     * Validate answer against input details
     * We will resolve either true or false from this function
     *
     * Note: sometimes we're stopping answers from passing through to
     * helper functions here, as ionic sometimes gives null and undefined
     */
    async validate (entry, params) {

        const self = this;

        // Set up the validators to use
        commonValidate.setValidators({
            text: textValidate,
            phone: phoneValidate,
            integer: integerValidate,
            decimal: decimalValidate,
            radio: radioValidate,
            dropdown: dropdownValidate,
            date: dateValidate,
            time: timeValidate,
            textarea: textareaValidate,
            checkbox: checkboxValidate,
            barcode: barcodeValidate,
            searchsingle: searchsingleValidate,
            searchmultiple: searchmultipleValidate,
            location: locationValidate
        });
        // Reset errors object
        this.resetErrors();

        const answer = params.answer.answer;
        //is there a confirmAnswer set?
        const confirmAnswer = params.confirmAnswer?.answer;

        return new Promise((resolve, reject) => {

            self.isUnique(entry, params.input_details, answer).then(function (response) {

                self.inputRef = params.input_details.ref;

                if (!response) {
                    // Assign error for non-uniqueness
                    self.errors[self.inputRef] = ['ec5_22'];
                    reject();
                    return;
                }

                // If we have a confirm field, check
                if (params.input_details.verify) {
                    if (answer !== null && confirmAnswer !== null) {
                        if (!commonValidate.checkConfirmed(params.input_details, answer, confirmAnswer)) {
                            // Assign errors from the answer validator helper
                            self.errors = commonValidate.getErrors();
                            reject();
                            return;
                        }
                    }
                }

                // If we have a required field, check
                if (!commonValidate.checkRequired(params.input_details, answer)) {
                    // Assign errors from the answer validator helper
                    self.errors = commonValidate.getErrors();
                    reject();
                    return;
                }

                // If we have a regex field, check
                if (answer !== '' && answer !== null && typeof answer !== 'undefined') {
                    if (!commonValidate.checkRegex(params.input_details, answer)) {
                        // Assign errors from the answer validator helper
                        self.errors = commonValidate.getErrors();
                        reject();
                        return;
                    }
                }

                // Checks this answer against the input type
                if (!commonValidate.answerChecks(params)) {
                    // Assign errors from the answer validator helper
                    self.errors = commonValidate.getErrors();
                    reject();
                    return;
                }

                resolve();

            }, function (error) {
                // If we hit here, probably had db access issues
                reject(error);
            });
        });

    },
    getErrors () {
        return this.errors;
    },
    hasErrors () {
        return Object.keys(this.errors).length > 0;
    },
    /**
     * Reset all errors in this class and in answer validate helper
     */
    resetErrors () {
        this.errors = {};
        commonValidate.resetErrors();
    },

    /* HELPER FUNCTIONS */

    /**
     * Check answer is unique, if applicable
     */
    isUnique (entry, inputDetails, answer) {

        const rootStore = useRootStore();
        let checkUnique = true;

        //Here we activate the uniqueness check only on compatible questions
        switch (inputDetails.type) {
            //Also lowercase() open-text answers for comparison
            case PARAMETERS.QUESTION_TYPES.TEXT:
            case PARAMETERS.QUESTION_TYPES.BARCODE:
            case PARAMETERS.QUESTION_TYPES.PHONE:
            case PARAMETERS.QUESTION_TYPES.TEXTAREA:
                answer = answer.toLowerCase();
                break;
            case PARAMETERS.QUESTION_TYPES.INTEGER:
            case PARAMETERS.QUESTION_TYPES.DECIMAL:
            case PARAMETERS.QUESTION_TYPES.DATE:
            case PARAMETERS.QUESTION_TYPES.TIME:
                break;
            default:
                checkUnique = false;
        }

        return new Promise(function (resolve, reject) {
            // If this input has uniqueness set
            if (checkUnique && inputDetails.uniqueness !== 'none' && answer !== '') {
                if (rootStore.isPWA) {
                    const formRef = rootStore.routeParams.formRef;
                    const inputRef = inputDetails.ref;
                    const projectVersion = projectModel.getLastUpdated();
                    const projectSlug = projectModel.getSlug();
                    const payload = JSONTransformerService.makeUniqueEntry(formRef, entry, inputRef, answer, projectVersion);
                    let tempAnswerFound = false;
                    //bypass uniqueness check for debugging locally
                    if (PARAMETERS.BYPASS_UNIQUENESS && PARAMETERS.IS_LOCALHOST) {
                        notificationService.showToast('bypassed uniqueness check!', 0, 'top');
                        resolve(true);
                    }
                    else {
                        // check uniqueness against the entries saved on the server

                        //if branch, first check uniqueness against temp branch entries
                        if (entry.isBranch) {

                            console.log({ tempBranches: rootStore.queueTempBranchEntriesPWA });

                            //get branches by branchRef
                            const tempBranches = rootStore.queueTempBranchEntriesPWA[entry.ownerInputRef] || [];
                            //any match in temp branch answers?
                            tempBranches.every((tempBranch) => {
                                const tempAnswer = tempBranch.branch_entry.answers[inputRef].answer;
                                if (tempAnswer === answer) {
                                    //match found, if NOT an edit on same uuid, bail out
                                    if (entry.entryUuid !== tempBranch.id) {
                                        //match found, bail out
                                        resolve(false);
                                        tempAnswerFound = true;
                                        return false;
                                    }
                                }
                                return true;
                            });
                        }

                        //check uniqueness on server (only when temp branch entries are ok)
                        if (!tempAnswerFound) {
                            webService.checkUniquenessPWA(projectSlug, payload).then((response) => {
                                //ec5_249 answer unique
                                if (response.data.data.code === 'ec5_249') {
                                    resolve(true);
                                }
                                else {
                                    resolve(false);
                                }
                            }, (error) => {
                                //ec5_22 answer NOT unique
                                if (error.data?.errors[0]?.code === 'ec5_22') {
                                    resolve(false);
                                }
                                else {
                                    console.log(error);
                                    reject(error);
                                }
                            });
                        }
                    }
                }
                else {
                    databaseSelectService.isUnique(entry, inputDetails, answer).then(function (res) {
                        // If there exists an entry in the db with this answer, resolve false
                        if (res.rows.length > 0) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    }, function (error) {
                        // If we hit here, probably had db access issues
                        reject(error);
                    });
                }
            } else {
                resolve(true);
            }
        });
    }

};