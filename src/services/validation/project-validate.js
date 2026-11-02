import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { rollbarService } from '@/services/utilities/rollbar-service';
import { regexService } from '@/services/validation/regex-service';

//question and pattern come from the project definition: never inject them raw
function escapeHtml (value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;'
    })[character]);
}

function isCompilableByJavaScript (pattern) {
    try {
        new RegExp(pattern);
        return true;
    } catch (error) {
        return false;
    }
}

//fallback for devices without WASM: the JavaScript engine is all we have there,
//but it must not be used for patterns it compiles with a different meaning
function fallbackRejectionMessage (pattern) {
    if (!isCompilableByJavaScript(pattern)) {
        return 'JavaScript cannot compile this pattern';
    }
    //it compiles, but JavaScript would read some of it as literal characters
    if (regexService.usesPcreOnlySyntax(pattern)) {
        return 'PCRE-only syntax JavaScript would read differently';
    }
    return null;
}

export const projectValidate = {

    // Patterns are authored for PHP/PCRE: validate them with a PCRE2 engine, so
    // PCRE-only syntax (possessive quantifiers, recursion, ...) is not rejected
    async findInvalidRegexes (projectExtra) {
        const invalidRegexes = [];
        const inputs = projectExtra?.inputs;

        if (!inputs) {
            return invalidRegexes;
        }

        const addInvalid = (inputRef, inputDetails, message) => {
            invalidRegexes.push({
                ref: inputRef,
                question: inputDetails.question,
                regex: inputDetails.regex,
                message
            });
        };

        const engineAvailable = await regexService.isAvailable();

        for (const inputRef of Object.keys(inputs)) {
            const inputDetails = inputs[inputRef].data;

            if (!inputDetails || !inputDetails.regex) {
                continue;
            }

            if (engineAvailable) {
                try {
                    const result = await regexService.validatePattern(inputDetails.regex);
                    if (!result.valid) {
                        addInvalid(inputRef, inputDetails, result.message);
                    }
                } catch (error) {
                    //engine failed mid-import: fall back to the JavaScript check
                    const message = fallbackRejectionMessage(inputDetails.regex);
                    if (message) {
                        addInvalid(inputRef, inputDetails, message);
                    }
                }
            } else {
                const message = fallbackRejectionMessage(inputDetails.regex);
                if (message) {
                    addInvalid(inputRef, inputDetails, message);
                }
            }
        }

        return invalidRegexes;
    },

    // Standard error alert (Learn More | OK), pointing at the docs
    async showInvalidRegexAlert (invalidRegexes, project) {
        const rootStore = useRootStore();
        const language = rootStore.language;

        //name the affected questions and patterns in the alert, log the input ref too
        const details = invalidRegexes.map((invalidRegex) => {
            console.warn('Invalid regex in project definition for question "' + invalidRegex.question + '" (' + invalidRegex.ref + '): ' + invalidRegex.regex + ' (' + invalidRegex.message + ')');
            return '"' + escapeHtml(invalidRegex.question) + '" (' + escapeHtml(invalidRegex.regex) + ')';
        }).join('<br>');

        //surface the rejected project definition so it can be corrected server-side
        rollbarService.criticalWithContext('project import: invalid regex pattern', {
            project,
            invalidRegexes
        });

        await notificationService.showDismissAlert(
            STRINGS[language].status_codes.ec5_392 + '<br><br>' + details,
            STRINGS[language].labels.error,
            PARAMETERS.PROJECT_REGEX_DOCS_URL,
            STRINGS[language].labels.ok
        );
    }
};
