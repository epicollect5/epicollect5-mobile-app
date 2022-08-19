import { answerValidateService } from '@/services/validation/answer-validate-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { vi } from 'vitest';
import { PARAMETERS } from '@/config';

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
        type: 'barcode',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: null,
        is_title: true,
        question: 'Name?',
        uniqueness: 'none',
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

vi.mock('@/services/database/database-select-service', () => {
    const databaseSelectService = vi.fn();
    databaseSelectService.isUnique = vi.fn();
    return { databaseSelectService };
});

describe('answerValidateService', () => {
    beforeEach(() => {

    });
    afterEach(() => {
        // vi.restoreAllMocks();
    });
    it('BARCODE answer too long', async () => {

        const type = params.input_details.type.toUpperCase();
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type];
        params.answer.answer = ''.padStart(maxLength + 1, '#');

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_214": "Answer too long"
            [inputRef]: ['ec5_214']
        });
    });
    it('BARCODE answer required is provided', async () => {

        params.answer.answer = 'Mirko';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('BARCODE answer not matching regex 1', async () => {

        params.answer.answer = '5Mirko5';
        params.input_details.regex = 'a-zA-Z]*$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('BARCODE answer not matching regex 2', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.regex = '^[0-9]+$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('BARCODE answer not matching regex 3', async () => {

        params.answer.answer = ' Mirko Mirko Mirko Mirko Mirko Mirko Mirko Mirko';
        params.input_details.regex = '^.{1,20}$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('BARCODE answer required but missing', async () => {

        params.answer.answer = '';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('BARCODE answer unique', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        console.log(answerValidateService.getErrors());
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('BARCODE answer NOT unique form', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        console.log(answerValidateService.getErrors());
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    // it('BARCODE answer NOT unique hierarchy', async () => {

    //     params.answer.answer = 'Mirko';
    //     params.input_details.uniqueness = 'hierarchy';
    //     databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

    //     await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
    //     expect(answerValidateService.getErrors()).toMatchObject({
    //         //"ec5_22": "Answer is not unique."
    //         [inputRef]: ['ec5_22']
    //     });
    //     params.input_details.uniqueness = 'none';
    // });
});
