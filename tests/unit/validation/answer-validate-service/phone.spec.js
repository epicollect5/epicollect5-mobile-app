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
        type: 'phone',
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
    it('PHONE answer too long', async () => {

        const type = params.input_details.type.toUpperCase();
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type];
        params.answer.answer = ''.padStart(maxLength + 1, '8');

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_214": "Answer too long"
            [inputRef]: ['ec5_214']
        });
    });
    it('PHONE answer required is provided', async () => {

        params.answer.answer = '334567890';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('PHONE answer not matching regex 1', async () => {

        params.answer.answer = '33455667789';
        params.input_details.regex = 'a-zA-Z]*$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('PHONE answer not matching regex 2', async () => {

        params.answer.answer = '3445435-66456456456';
        params.input_details.regex = '^[0-9]+$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('PHONE answer not matching regex 3', async () => {

        params.answer.answer = '3455678653454';
        params.input_details.regex = '^.{1,5}$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('PHONE answer required but missing', async () => {

        params.answer.answer = '';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('PHONE answer unique', async () => {

        params.answer.answer = '334567890';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('PHONE answer NOT unique form', async () => {

        params.answer.answer = '34522200';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('PHONE answer NOT unique hierarchy', async () => {

        params.answer.answer = '334567834456';
        params.input_details.uniqueness = 'hierarchy';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('PHONE answer double entry verification missing', async () => {

        params.answer.answer = '4567890';
        params.confirmAnswer.answer = '';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('PHONE answer double entry verification case sensitive', async () => {

        params.answer.answer = '3334567u';
        params.confirmAnswer.answer = '3334567U';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('PHONE answer double entry verification not matching', async () => {

        params.answer.answer = 'Toni';
        params.confirmAnswer.answer = 'Bepi';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('PHONE answer double entry verification matching', async () => {

        params.answer.answer = 'Cats';
        params.confirmAnswer.answer = 'Cats';
        params.input_details.verify = 'true';
        expect.assertions(2);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});
    });
});
