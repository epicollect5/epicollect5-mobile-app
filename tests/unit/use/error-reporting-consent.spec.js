import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {rollbarService} from '@/services/utilities/rollbar-service';
import {
    applyErrorReportingConsent,
    answerErrorReportingConsent
} from '@/use/entry/error-reporting-consent';

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: {configure: vi.fn()}
}));

describe('error reporting consent (PWA)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('grants reporting immediately from a stored yes', () => {
        localStorage.setItem(
            PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY,
            PARAMETERS.PWA_ERROR_REPORTING_CONSENT.GRANTED
        );
        const rootStore = useRootStore();

        applyErrorReportingConsent();

        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: true});
        expect(rootStore.showErrorReportingConsentPWA).toBe(false);
    });

    it('keeps reporting off from a stored no', () => {
        localStorage.setItem(
            PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY,
            PARAMETERS.PWA_ERROR_REPORTING_CONSENT.DECLINED
        );
        const rootStore = useRootStore();

        applyErrorReportingConsent();

        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: false});
        expect(rootStore.showErrorReportingConsentPWA).toBe(false);
    });

    it('reports nothing and asks once without a stored answer', () => {
        const rootStore = useRootStore();

        applyErrorReportingConsent();

        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: false});
        expect(rootStore.showErrorReportingConsentPWA).toBe(true);
    });

    it('stores yes, enables reporting and stops asking', () => {
        const rootStore = useRootStore();
        rootStore.showErrorReportingConsentPWA = true;

        answerErrorReportingConsent(true);

        expect(localStorage.getItem(PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY))
            .toBe(PARAMETERS.PWA_ERROR_REPORTING_CONSENT.GRANTED);
        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: true});
        expect(rootStore.showErrorReportingConsentPWA).toBe(false);
    });

    it('stores no, keeps reporting off and stops asking', () => {
        const rootStore = useRootStore();
        rootStore.showErrorReportingConsentPWA = true;

        answerErrorReportingConsent(false);

        expect(localStorage.getItem(PARAMETERS.PWA_ERROR_REPORTING_CONSENT.STORAGE_KEY))
            .toBe(PARAMETERS.PWA_ERROR_REPORTING_CONSENT.DECLINED);
        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: false});
        expect(rootStore.showErrorReportingConsentPWA).toBe(false);
    });

    it('asks on every boot when storage cannot be read', () => {
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('storage denied');
            });
        const rootStore = useRootStore();

        applyErrorReportingConsent();

        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: false});
        expect(rootStore.showErrorReportingConsentPWA).toBe(true);
        getItemSpy.mockRestore();
    });

    it('survives a failing write and asks again on the next boot', () => {
        const rootStore = useRootStore();
        rootStore.showErrorReportingConsentPWA = true;
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('storage denied');
            });

        answerErrorReportingConsent(true);

        expect(rollbarService.configure).toHaveBeenCalledWith({enabled: true});
        expect(rootStore.showErrorReportingConsentPWA).toBe(false);
        setItemSpy.mockRestore();

        //the answer was not persisted: the next boot asks again
        applyErrorReportingConsent();
        expect(rootStore.showErrorReportingConsentPWA).toBe(true);
    });
});
