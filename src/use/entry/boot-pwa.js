import {STRINGS} from '@/config/strings';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {setupPWAEntry} from '@/use/entry/setup-pwa-entry';
import {commonValidate} from '@/services/validation/common-validate';
import {projectValidate} from '@/services/validation/project-validate';
import {projectModel} from '@/models/project-model.js';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {initService} from '@/services/init-service';
import {webService} from '@/services/web-service';
import {applyErrorReportingConsent} from '@/use/entry/error-reporting-consent';

//PWA boot: apply the error reporting consent, parse the entry URL, fetch the
//project and set up a new or existing entry. The app mounts afterwards in
//main.js, so a failure here lands on the notFound view, never a blank page
export async function bootPWA() {
    const rootStore = useRootStore();

    //error reporting follows the stored consent (cookie-consent semantics):
    //an existing answer gates reporting immediately; without one, nothing is
    //reported and the consent toast asks once the app is mounted. Payloads
    //are tagged 'pwa' at build time either way; init() at mount adds the Vue
    //error handler and the fingerprinting
    applyErrorReportingConsent();

    const searchParams = new URLSearchParams(window.location.search);
    rootStore.searchParams = searchParams;
    const urlSegments = window.location.pathname.split('/');
    const acceptedSegments = [PARAMETERS.PWA_ADD_ENTRY, PARAMETERS.PWA_EDIT_ENTRY];
    const providedSegment = urlSegments.pop();
    if (!acceptedSegments.includes(providedSegment)) {
        rootStore.notFound = true;
    }

    // Display the key/value pairs
    for (const [key, value] of searchParams.entries()) {
        console.log(`${key}, ${value}`);
    }

    //start PWA by getting the server URL for vue router and internal API requests
    //always same-origin: production and the dev bundle (loaded into the laravel
    //page via the blade hot-file support) are both served by laravel, so the
    //current URL minus the entry segment is the API base in both cases
    const url = new URL(window.location.href);
    rootStore.serverUrl = url.origin + utilsService.getBasepath();
    console.log('Server URL -> ', rootStore.serverUrl);

    //set en as language (PWA can get translated by browser tools)
    rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;

    //load language files for PWA
    await initService.getLanguagePWA();

    if (!rootStore.notFound) {
        const projectSlug = window.location.pathname.split('/').splice(-2, 1)[0];
        console.log({path: window.location.pathname}, projectSlug);

        try {
            //get requested project and init PWA
            const response = await webService.getProjectPWA(projectSlug);
            projectModel.initialisePWA((response));

            // Reject a structure whose patterns cannot be evaluated, otherwise
            // the Regex constraint for that question would silently never apply
            const invalidRegexes = await projectValidate.findInvalidRegexes(response.json_extra);
            if (invalidRegexes.length > 0) {
                throw {
                    isInvalidRegexError: true,
                    invalidRegexes,
                    project: {
                        slug: projectModel.getSlug(),
                        ref: projectModel.getProjectRef()
                    }
                };
            }

            // Set up a new entry or edit the existing one
            let formRef = '';
            let isBranch = false;
            if
            (rootStore.searchParams.get('branch_ref')
                && rootStore.searchParams.get('branch_owner_uuid')) {
                isBranch = true;
            }

            if (providedSegment === PARAMETERS.PWA_ADD_ENTRY) {
                try {
                    formRef = await setupPWAEntry(PARAMETERS.PWA_ADD_ENTRY, isBranch);
                    rootStore.providedSegment = PARAMETERS.PWA_ADD_ENTRY;
                } catch (error) {
                    console.log(error);
                    rootStore.notFound = true;
                }
            } else {
                //fetch existing entry (uuid must be provided)
                if (!rootStore.searchParams.has('uuid')) {
                    rootStore.notFound = true;
                }
                const entryUuid = rootStore.searchParams.get('uuid');
                if (!commonValidate.isValidUuid(entryUuid)) {
                    rootStore.notFound = true;
                }

                try {
                    formRef = await setupPWAEntry(PARAMETERS.PWA_EDIT_ENTRY, isBranch);
                    rootStore.providedSegment = PARAMETERS.PWA_EDIT_ENTRY;
                } catch (error) {
                    console.log(error);
                    rootStore.notFound = true;
                }
            }

            //update route params BRANCH
            if (isBranch) {
                console.log('should open branch');
                rootStore.routeParams = {
                    formRef,
                    inputRef: null,
                    inputIndex: 0,
                    isBranch: true,
                    error: {}
                };
            } else {
                console.log('should open hierarchy');
                //update route params HIERARCHY
                rootStore.routeParams = {
                    formRef,
                    inputRef: null,
                    inputIndex: 0,
                    isBranch: false,
                    error: {}
                };
            }
        } catch (error) {
            console.log(error);
            if (error?.isInvalidRegexError) {
                // Project definition has a pattern the app cannot evaluate
                await projectValidate.showInvalidRegexAlert(error.invalidRegexes, error.project, 'open');
            } else if (error) {
                await notificationService
                    .showAlert(error.statusText, error.status);
            } else {
                await notificationService
                    .showAlert(STRINGS[rootStore.language].labels.unknown_error);
            }
            rootStore.notFound = true;
        }
    }
}
