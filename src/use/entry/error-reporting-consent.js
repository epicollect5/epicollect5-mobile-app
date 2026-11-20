import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {rollbarService} from '@/services/utilities/rollbar-service';

//error reporting consent (PWA), cookie-consent semantics: a stored answer
//gates reporting from the earliest moment (localStorage is read
//synchronously at boot, unlike the native preference which lives in the
//database); without a stored answer nothing is reported and the consent
//toast asks once the app is mounted. Only yes|no hide it: to be asked
//again, the browser data must be cleared
//
//If VITE_ROLLBAR_CONSENT_PWA is not set or empty, Rollbar reporting is
//always enabled by default and the consent toast is not shown. If set to
//1, the consent flow is used.
export function applyErrorReportingConsent() {
    const rootStore = useRootStore();
    
    //Check if the consent flag is enabled
    const consentFlagEnabled = PARAMETERS.ROLLBAR_CONSENT_PWA === '1';
    
    if (!consentFlagEnabled) {
        //Flag not set or empty: enable Rollbar by default, no consent toast
        rollbarService.configure({enabled: true});
        rootStore.showErrorReportingConsentPWA = false;
        return;
    }
    
    //Consent flow is enabled: check stored consent
    const consent = readStoredConsent();
    if (consent === PARAMETERS.PWA_ERROR_REPORTING_CONSENT.GRANTED) {
        rollbarService.configure({enabled: true});
    }
    else {
        //declined or not answered yet: nothing is reported either way
        rollbarService.configure({enabled: false});
        if (consent === null) {
            rootStore.showErrorReportingConsentPWA = true;
        }
    }
}

export function answerErrorReportingConsent(granted) {
    const rootStore = useRootStore();
    //storage can be unavailable (private browsing, disabled site data): a
    //reporting choice must not crash the app, so the toast simply comes
    //back on the next boot
    try {
        localStorage.setItem(
            PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY,
            granted
                ? PARAMETERS.PWA_ERROR_REPORTING_CONSENT.GRANTED
                : PARAMETERS.PWA_ERROR_REPORTING_CONSENT.DECLINED
        );
    } catch (error) {
        console.log('error reporting consent not stored: ' + error);
    }
    rollbarService.configure({enabled: granted});
    rootStore.showErrorReportingConsentPWA = false;
}

//unreadable storage behaves as unanswered: the toast asks on every boot
function readStoredConsent() {
    try {
        return localStorage.getItem(PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY);
    } catch (error) {
        return null;
    }
}
