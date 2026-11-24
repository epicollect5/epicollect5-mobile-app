import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { entryCommonService } from '@/services/entry/entry-common-service';
import { handleNext } from '@/use/questions/handle-next';
import { projectModel } from '@/models/project-model.js';

//regression guard: a validation error raised by ANY question type on next()
//must always reach the UI. A group validates its inputs and the main input
//through concurrent validate() calls that share the errors object; when those
//checks ran synchronously the last sibling reset wiped an earlier group
//input's error, so the user was stuck on the question with no alert.
//These specs drive the real validation stack through the real handleNext()
//error path and assert the alert is shown for every question type.

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({ language: 'en' }))
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getExtraInputs: vi.fn(),
        getFormGroups: vi.fn(),
        getLastUpdated: vi.fn(),
        getSlug: vi.fn()
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
        showAlert: vi.fn(() => Promise.resolve()),
        showToast: vi.fn(),
        showNativeLoader: vi.fn(() => Promise.resolve()),
        hideNativeLoader: vi.fn(),
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn()
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
    webService: {
        checkUniquenessPWA: vi.fn()
    }
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

//initial-setup pulls the entry services back in at import time; the error
//path never reaches it
vi.mock('@/use/questions/initial-setup', () => ({
    initialSetup: vi.fn(),
    warmRegexEngine: vi.fn()
}));

const EMPTY = { answer: '', was_jumped: false };
const NO_SELECTION = { answer: [], was_jumped: false };
const NO_LOCATION = { answer: {}, was_jumped: false };

//one invalid answer per question type: a required question left unanswered
//(ec5_21) — location answers are objects, so an empty location object fails its
//own validator (ec5_30) instead
const SINGLE_CASES = [
    { type: PARAMETERS.QUESTION_TYPES.TEXT, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.PHONE, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.TEXTAREA, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.INTEGER, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.DECIMAL, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.DATE, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.TIME, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.RADIO, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.DROPDOWN, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.BARCODE, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.PHOTO, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.AUDIO, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.VIDEO, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.BRANCH, answer: EMPTY, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.CHECKBOX, answer: NO_SELECTION, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE, answer: NO_SELECTION, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE, answer: NO_SELECTION, code: 'ec5_21' },
    { type: PARAMETERS.QUESTION_TYPES.LOCATION, answer: NO_LOCATION, code: 'ec5_30', isRequired: false }
];

function inputDetails(type, ref, overrides = {}) {
    return {
        ref,
        type,
        is_required: true,
        uniqueness: 'none',
        verify: false,
        regex: null,
        min: '',
        max: '',
        default: null,
        is_title: false,
        question: 'Q?',
        datetime_format: null,
        possible_answers: [],
        set_to_current_datetime: false,
        group: [],
        branch: [],
        jumps: [],
        ...overrides
    };
}

function stateFor(details, answers, confirmAnswer, currentInputRef) {
    return {
        disableNext: false,
        disablePrevious: false,
        isFetching: false,
        existingAnswer: '',
        answers,
        confirmAnswer,
        inputDetails: details,
        error: { hasError: false, errors: {} },
        questionParams: {
            type: details.type,
            currentInputRef,
            currentInputIndex: 0,
            isBranch: false
        }
    };
}

function scopeFor(entry) {
    return {
        entryService: {
            validateAnswer: (params) => entryCommonService.validateAnswer(entry, params)
        }
    };
}

//the alert text is the status-code string the server ships at init
function expectedMessage(code) {
    return STRINGS.en.status_codes[code];
}

async function submit(state, entry) {
    await handleNext(state, scopeFor(entry));
    await vi.waitFor(() => {
        expect(notificationService.showAlert).toHaveBeenCalledTimes(1);
    });
    return notificationService.showAlert.mock.calls[0][0];
}

describe('a validation error on next() is always surfaced in the UI', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        useRootStore().language = 'en';
        //status codes arrive from the server at init (init-service): seed the
        //codes these flows produce
        STRINGS.en.status_codes = {
            ec5_21: 'This is a required question',
            ec5_30: 'Location data not valid.'
        };
    });

    it.each(SINGLE_CASES)('single $type question shows the alert', async ({ type, answer, code, isRequired }) => {
        const ref = 'input_ref';
        const details = inputDetails(type, ref, { is_required: isRequired ?? true });
        projectModel.getExtraInputs.mockReturnValue({ [ref]: { data: details } });

        const answers = { [ref]: answer };
        const confirmAnswer = { [ref]: { verify: false, answer: '' } };
        const entry = { formRef: 'form-1', isBranch: false, answers, uniqueAnswers: {} };
        const state = stateFor(details, answers, confirmAnswer, ref);

        const message = await submit(state, entry);

        expect(message).toBe(expectedMessage(code));
        expect(state.error.hasError).toBe(true);
        expect(state.error.errors[ref].message).toBe(expectedMessage(code));
    });

    it('group question shows the alert for the failing group input', async () => {
        const groupRef = 'group_ref';
        const childRef = 'child_ref';
        const groupDetails = inputDetails(PARAMETERS.QUESTION_TYPES.GROUP, groupRef, { is_required: false });
        const childDetails = inputDetails(PARAMETERS.QUESTION_TYPES.TEXT, childRef, { is_required: true });
        projectModel.getExtraInputs.mockReturnValue({
            [groupRef]: { data: groupDetails },
            [childRef]: { data: childDetails }
        });
        projectModel.getFormGroups.mockReturnValue({ [groupRef]: [childRef] });

        const answers = {
            [groupRef]: { answer: '', was_jumped: false },
            [childRef]: { answer: '', was_jumped: false }
        };
        const confirmAnswer = {
            [groupRef]: { verify: false, answer: '' },
            [childRef]: { verify: false, answer: '' }
        };
        const entry = { formRef: 'form-1', isBranch: false, answers, uniqueAnswers: {} };
        const state = stateFor(groupDetails, answers, confirmAnswer, groupRef);

        const message = await submit(state, entry);

        //the group input is the one left unanswered: its error must reach the
        //UI, not be swallowed by a sibling validation
        expect(message).toBe(expectedMessage('ec5_21'));
        expect(state.error.hasError).toBe(true);
        expect(state.error.errors[childRef].message).toBe(expectedMessage('ec5_21'));
    });

    it('question nested in a branch entry shows the alert', async () => {
        const ref = 'input_ref';
        const details = inputDetails(PARAMETERS.QUESTION_TYPES.TEXT, ref, { is_required: true });
        projectModel.getExtraInputs.mockReturnValue({ [ref]: { data: details } });

        const answers = { [ref]: EMPTY };
        const confirmAnswer = { [ref]: { verify: false, answer: '' } };
        //a branch entry runs the same validation stack with isBranch set
        const entry = { formRef: 'form-1', isBranch: true, answers, uniqueAnswers: {} };
        const state = stateFor(details, answers, confirmAnswer, ref);
        state.questionParams.isBranch = true;

        const message = await submit(state, entry);

        expect(message).toBe(expectedMessage('ec5_21'));
        expect(state.error.hasError).toBe(true);
        expect(state.error.errors[ref].message).toBe(expectedMessage('ec5_21'));
    });
});
