import { PARAMETERS } from '@/config';

import * as services from '@/services';
import { STRINGS } from '@/config/strings';


import { useRootStore } from '@/stores/root-store';


export const errorsService = {

    getEc5Errors (errors) {
        // Check we were given an array of errors
        if (errors && errors.constructor === Array && errors.length > 0) {
            // Show all errors
            for (let i = 0; i < errors.length; i++) {
                if (Object.prototype.hasOwnProperty.call(errors, i) && Object.prototype.hasOwnProperty.call(errors[i], 'code')) {
                    // Return first error
                    return errors[0].code;
                }
            }
        }
    },

    getStatusError (status) {
        switch (status) {
            case 0:
                // Unknown error, warn user
                return 'ec5_103';
            case 404:
                // Server url wrong?
                return 'ec5_142';
            default:
                // Something else went wrong
                return 'ec5_116';
        }
    },

    getWebErrorCode (response) {
        if (response) {
            // Check for an ec5 error
            Object.prototype.hasOwnProperty.call(response, 'status');
            if (Object.prototype.hasOwnProperty.call(response, 'data') && response.data !== null) {
                if (Object.prototype.hasOwnProperty.call(response.data, 'errors')) {
                    return this.getEc5Errors(response.data.errors);
                }
            } else if (Object.prototype.hasOwnProperty.call(response, 'status')) {
                // If no ec5  error found, check if we have a status error
                return this.getStatusError(response.status);
            }
        }
        // Default error code
        return 'ec5_116';
    },
    async handleWebError (response) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        let errorCode;
        // No internet? (yeah let's say the connection dropped...)
        const hasInternetConnection = await services.utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
            errorCode = 'ec5_135';
        } else {
            errorCode = this.getWebErrorCode(response);
        }
        services.notificationService.showAlert(STRINGS[language].status_codes[errorCode], STRINGS[language].labels.error);
    },


    handleAuthError (error) {
        //show modal asking user to enter six digit code to confirm login

        //if code correct log user in (server adds both passwordless and apple provider to same email)
    },

    // Handle errors received when moving between questions
    handleEntryErrors (errors, scopeErrors, inputRefs) {

        const rootStore = useRootStore();
        const language = rootStore.language;

        this.resetEntryErrors(scopeErrors, inputRefs);
        let inputRef;

        // If we have any new errors, notify user
        for (inputRef in errors) {
            if (Object.prototype.hasOwnProperty.call(errors, inputRef)) {
                // Add first non empty error to $scope.error object
                if (errors[inputRef].message !== '') {
                    scopeErrors.hasError = true;
                    scopeErrors.errors[inputRef] = errors[inputRef];
                    // Show error notification
                    services.notificationService.showAlert(scopeErrors.errors[inputRef].message, STRINGS[language].labels.error);
                    // Break after first error
                    break;
                }
            }
        }
    },

    resetEntryErrors (scopeErrors, inputRefs) {

        let inputRef;
        // Assume we have no errors
        scopeErrors.hasError = false;

        // Now loop each input and reset any errors that applies to them (ignoring errors that don't)
        for (inputRef in scopeErrors.errors) {
            if (Object.prototype.hasOwnProperty.call(scopeErrors.errors, inputRef)) {

                // Reset any errors that apply only to the inputs that were just validated
                if (inputRefs.indexOf(inputRef) > -1) {
                    scopeErrors.errors[inputRef].message = '';
                }

                // Check if we still have non empty errors
                if (scopeErrors.errors[inputRef].message !== '') {
                    // Then we must still have errors
                    scopeErrors.hasError = true;
                }
            }
        }
    },

    needsToLogin (errorCode) {
        // Check for error authentication error codes (private project, user needs to login)
        // If we find one, we know the user will need to log in
        return PARAMETERS.AUTH_ERROR_CODES.indexOf(errorCode) > -1;
    }
};