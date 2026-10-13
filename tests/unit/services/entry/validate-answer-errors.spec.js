import { describe, it, expect, vi } from 'vitest';
import { entryCommonService } from '@/services/entry/entry-common-service';
import { errorsService } from '@/services/errors-service';
import { STRINGS } from '@/config/strings';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({ language: 'en' }))
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getExtraInputs: vi.fn(() => ({}))
    }
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false)
    }
}));

vi.mock('@capacitor/network', () => ({
    Network: {}
}));

vi.mock('@capacitor/barcode-scanner', () => ({
    CapacitorBarcodeScanner: {},
    CapacitorBarcodeScannerTypeHint: {}
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showAlert: vi.fn(() => Promise.resolve())
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: {
        critical: vi.fn(),
        criticalWithContext: vi.fn()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {}
}));

vi.mock('@/services/web-service', () => ({
    webService: {}
}));

vi.mock('@/services/entry/branch-entry-service', () => ({
    branchEntryService: {}
}));

vi.mock('@/services/utilities/location-cordova-service', () => ({
    locationService: {}
}));

vi.mock('@/services/entry/jumps-service', () => ({
    jumpsService: {}
}));

const mainInputDetails = {
    ref: 'date1',
    type: 'date',
    is_required: true,
    uniqueness: 'none',
    verify: false,
    regex: ''
};

function makeEntryFlow(answer) {
    const answers = {
        date1: {
            answer,
            was_jumped: false
        }
    };
    const entry = {
        formRef: 'form1',
        answers,
        uniqueAnswers: {}
    };
    const params = {
        answers,
        confirmAnswer: {},
        mainInputDetails,
        error: {
            hasError: false,
            errors: {}
        }
    };
    return { entry, params };
}

describe('date error lifecycle across failed and successful submits', () => {
    it('pins the required error on empty submit and clears it after answering', async () => {
        //status codes arrive from the server at init (init-service) and are
        //absent in tests: seed the one code this flow produces
        STRINGS.en.status_codes = { ec5_21: 'required' };
        const { entry, params } = makeEntryFlow('');

        //submit unanswered: required validation fails and the error is shown
        await expect(entryCommonService.validateAnswer(entry, params)).rejects.toBeDefined();
        await errorsService.handleEntryErrors(
            { date1: { message: 'required' } },
            params.error,
            ['date1']
        );
        expect(params.error.errors.date1.message).not.toBe('');

        //answer with a valid date: the next validation passes...
        params.answers.date1.answer = '2026-10-09';
        await entryCommonService.validateAnswer(entry, params);

        //...and the stale error is gone, so remounting cannot resurrect it
        expect(params.error.errors.date1.message).toBe('');
        expect(params.error.hasError).toBe(false);
    });
});
