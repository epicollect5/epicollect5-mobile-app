import { answerValidateService } from '@/services/validation/answer-validate-service';
import { vi } from 'vitest';
import { utilsService } from '@/services/utilities/utils-service';
import { setActivePinia, createPinia } from 'pinia';


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
        type: 'radio',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: '',
        is_title: true,
        question: 'Dropdown',
        uniqueness: 'none',
        is_required: true,
        datetime_format: null,
        possible_answers: [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ],
        set_to_current_datetime: false
    },
    answer: {
        was_jumped: false,
        answer: '62fcfc03a1b1c'
    },
    confirmAnswer: {
        verify: false,
        answer: ''
    }
};

vi.mock('@/services/database/database-select-service', () => {
    const databaseSelectService = vi.fn();
    databaseSelectService.isUnique = vi.fn();
    return { databaseSelectService };
});

describe('answerValidateService', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });
    afterEach(() => {
        // vi.restoreAllMocks();
    });
    it('RADIO answer does not match 1', async () => {

        params.answer.answer = utilsService.generateUniqID();

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });
    });
    it('RADIO answer does not match 2', async () => {

        params.answer.answer = utilsService.generateUniqID();

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });
    });
    it('RADIO answer required is provided', async () => {

        params.answer.answer = '62fcfc03a1b1c';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('RADIO answer required but missing', async () => {

        params.answer.answer = '';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('RADIO answer NOT required', async () => {

        params.answer.answer = '';
        params.input_details.is_required = false;

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
});
