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
        type: 'searchsingle',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: '',
        is_title: true,
        question: 'Checkbox',
        uniqueness: 'none',
        is_required: true,
        datetime_format: null,
        possible_answers: [
            {
                answer: '1',
                answer_ref: '62fd0291a1b1f'
            },
            {
                answer: '2',
                answer_ref: '62fd029da1b20'
            },
            {
                answer: '3',
                answer_ref: '62fd02a1a1b21'
            }
        ],
        set_to_current_datetime: false
    },
    answer: {
        was_jumped: false,
        answer: [
            '62fd0291a1b1f'
        ]
    },
    confirmAnswer: {
        verify: false,
        answer: [
            '62fd0291a1b1f'
        ]
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
    }),

        it('SEARCH_SINGLE allows single answer ONLY', async () => {

            params.answer.answer = ['62fd0291a1b1f', '62fd029da1b20'];
            await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
            expect(answerValidateService.getErrors()).toMatchObject({
                // "ec5_340": "Too many possible answers!"
                [inputRef]: ['ec5_340']
            });
        });

    it('SEARCH_SINGLE answer does not match', async () => {

        params.answer.answer = [utilsService.generateUniqID()];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });
    });
    it('SEARCH_SINGLE answer does not match', async () => {

        params.answer.answer = [utilsService.generateUniqID()];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });

        params.answer.answer = [utilsService.generateUniqID()];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });

        params.answer.answer = [utilsService.generateUniqID()];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //ec5_25 answer does not match
            [inputRef]: ['ec5_25']
        });
    });
    it('SEARCH_SINGLE answer required is provided', async () => {

        //1
        params.answer.answer = ['62fd0291a1b1f'];
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        //2
        params.answer.answer = ['62fd029da1b20'];
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        //3
        params.answer.answer = ['62fd02a1a1b21'];
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});

    });
    it('SEARCH_SINGLE answer required but missing', async () => {

        params.answer.answer = [];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('SEARCH_SINGLE answer NOT required', async () => {

        params.answer.answer = [];
        params.input_details.is_required = false;

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
});
