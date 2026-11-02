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

//entries rejected without the PCRE2 engine carry this reason, so the alert
//and the Rollbar report blame the device, not the project definition
const ENGINE_UNAVAILABLE_REASON = 'engine-unavailable';
//the cause is appended at the call site: it travels in the Rollbar payload, so
//an unexpected engine error is diagnosable without a second report
const ENGINE_UNAVAILABLE_MESSAGE = 'PCRE2 engine could not verify this pattern';

export const projectValidate = {

    // Patterns are authored for PHP/PCRE: validate them with a PCRE2 engine, so
    // PCRE-only syntax (possessive quantifiers, recursion, ...) is not rejected
    async findInvalidRegexes (projectExtra) {
        const invalidRegexes = [];
        const inputs = projectExtra?.inputs;

        if (!inputs) {
            return invalidRegexes;
        }

        const addInvalid = (inputRef, inputDetails, message, reason = null) => {
            invalidRegexes.push({
                ref: inputRef,
                question: inputDetails.question,
                regex: inputDetails.regex,
                message,
                reason
            });
        };

        for (const inputRef of Object.keys(inputs)) {
            const inputDetails = inputs[inputRef].data;

            if (!inputDetails || !inputDetails.regex) {
                continue;
            }

            try {
                const result = await regexService.validatePattern(inputDetails.regex);
                if (!result.valid) {
                    addInvalid(inputRef, inputDetails, result.message);
                }
            } catch (error) {
                //The engine is required, not optional: on the supported matrix a
                //failure here is a defect, never a device class. JavaScript is not
                //a stand-in for PCRE, so the pattern is refused as unverifiable
                //rather than judged by it. Loading failures are also reported by
                //the engine itself; the alert below reports the project and now
                //carries the cause of an unexpected post-load failure too.
                addInvalid(inputRef, inputDetails, ENGINE_UNAVAILABLE_MESSAGE + ': ' + error.message, ENGINE_UNAVAILABLE_REASON);
            }
        }

        return invalidRegexes;
    },

    // Standard error alert (Learn More | OK), pointing at the docs
    // Entries rejected without the PCRE2 engine get a distinct alert: the
    // patterns are unverified, not broken, so the device is at fault
    async showInvalidRegexAlert (invalidRegexes, project) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language] ? STRINGS[language].labels : STRINGS.en.labels;
        const withoutEngine = invalidRegexes.filter((invalidRegex) => invalidRegex.reason === ENGINE_UNAVAILABLE_REASON);

        //name the affected questions and patterns in the alert, log the input ref too
        const details = invalidRegexes.map((invalidRegex) => {
            const prefix = invalidRegex.reason === ENGINE_UNAVAILABLE_REASON ? 'Unverifiable regex' : 'Invalid regex';
            console.warn(prefix + ' in project definition for question "' + invalidRegex.question + '" (' + invalidRegex.ref + '): ' + invalidRegex.regex + ' (' + invalidRegex.message + ')');
            return '"' + escapeHtml(invalidRegex.question) + '" (' + escapeHtml(invalidRegex.regex) + ')';
        }).join('<br>');

        if (withoutEngine.length > 0) {
            rollbarService.criticalWithContext('project import: pattern unverifiable without PCRE2', {
                project,
                invalidRegexes
            });

            await notificationService.showDismissAlert(
                labels.regex_unverifiable + '<br><br>' + details,
                labels.error,
                null,
                labels.ok
            );
            return;
        }

        //surface the rejected project definition so it can be corrected server-side
        rollbarService.criticalWithContext('project import: invalid regex pattern', {
            project,
            invalidRegexes
        });

        await notificationService.showDismissAlert(
            STRINGS[language].status_codes.ec5_392 + '<br><br>' + details,
            labels.error,
            PARAMETERS.PROJECT_REGEX_DOCS_URL,
            labels.ok
        );
    }
};
