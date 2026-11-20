import { answerValidateService } from '@/services/validation/answer-validate-service';
import { webService } from '@/services/web-service';
import { vi } from 'vitest';
import { PARAMETERS } from '@/config';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/services/web-service', () => {
    const webService = vi.fn();
    webService.checkUniquenessPWA = vi.fn();
    return { webService };
});

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_62fa24caa1b10';
const entry = {
    entryUuid: '75523045-1954-4a3e-adc3-91500d5c65c4',
    parentEntryUuid: '',
    isRemote: 0,
    synced: 2,
    canEdit: 1,
    createdAt: '',
    title: '',
    formRef: '70dcdb0b606843989674d3851c544f23_62fa24c5161be',
    parentFormRef: '',
    projectRef: '70dcdb0b606843989674d3851c544f23',
    branchEntries: {},
    media: {},
    uniqueAnswers: {},
    syncedError: '',
    isBranch: false,
    verifyAnswers: {},
    answers: {
        [inputRef]: {
            was_jumped: false,
            answer: ''
        }
    }
};

const params = {
    input_details: {
        max: null,
        min: null,
        ref: inputRef,
        type: 'text',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: null,
        is_title: true,
        question: 'Name?',
        uniqueness: 'form',
        is_required: true,
        datetime_format: null,
        possible_answers: [],
        set_to_current_datetime: false
    },
    answer: {
        was_jumped: false,
        answer: ''
    },
    confirmAnswer: {
        verify: false,
        answer: ''
    }
};

describe('answerValidateService PWA uniqueness', () => {

    const originalBypassUniqueness = PARAMETERS.BYPASS_UNIQUENESS;

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.routeParams.formRef = entry.formRef;
        //the dev bypass flag is on in .env.local: tests must exercise the real check
        PARAMETERS.BYPASS_UNIQUENESS = false;
        params.answer.answer = 'Mirko';
    });

    afterEach(() => {
        PARAMETERS.BYPASS_UNIQUENESS = originalBypassUniqueness;
        webService.checkUniquenessPWA.mockReset();
    });

    it('PWA unique answer passes the uniqueness check', async () => {

        webService.checkUniquenessPWA.mockResolvedValue({ data: { data: { code: 'ec5_249' } } });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        expect(webService.checkUniquenessPWA).toHaveBeenCalledTimes(1);
    });

    it('PWA NOT unique answer shows ec5_22', async () => {

        //webService rejects with the axios response
        webService.checkUniquenessPWA.mockRejectedValue({
            data: {
                errors: [
                    {
                        code: 'ec5_22',
                        title: 'Answer is not unique.',
                        source: 'uniqueness-controller'
                    }
                ]
            },
            status: 422
        });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
    });

    it('PWA locked project shows ec5_202, not an unknown error', async () => {

        webService.checkUniquenessPWA.mockRejectedValue({
            data: {
                errors: [
                    {
                        code: 'ec5_202',
                        title: 'This project is currently locked.',
                        source: 'uniqueness-controller'
                    }
                ]
            },
            status: 422
        });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_202": "This project is currently locked."
            [inputRef]: ['ec5_202']
        });
    });
});
