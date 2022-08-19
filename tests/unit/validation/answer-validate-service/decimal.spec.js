import { answerValidateService } from '@/services/validation/answer-validate-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { vi } from 'vitest';
import { PARAMETERS } from '@/config';

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_62fba82ca1b11';
const entry = {
    entryUuid: 'f5f93005-8b14-4c82-88e2-2f5769797a99',
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
            answer: '3'
        }
    }
};

const params = {

    input_details: {
        max: '',
        min: '',
        ref: inputRef,
        type: 'decimal',
        group: [],
        jumps: [],
        regex: '',
        branch: [],
        verify: false,
        default: '',
        is_title: false,
        question: 'Decimal Q?',
        uniqueness: 'none',
        is_required: true,
        datetime_format: null,
        possible_answers: [],
        set_to_current_datetime: false
    },
    answer: {
        was_jumped: false,
        answer: '3.1'
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
    it('DECIMAL answer too long', async () => {

        const type = params.input_details.type.toUpperCase();
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type];
        params.answer.answer = ''.padStart(maxLength + 1, '7');

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_214": "Answer too long"
            [inputRef]: ['ec5_214']
        });
    });
    it('DECIMAL answer required is provided', async () => {

        params.answer.answer = '4.5';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('DECIMAL answer not matching regex 1', async () => {

        params.answer.answer = '3.8';
        params.input_details.regex = 'a-zA-Z]*$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('DECIMAL answer not matching regex 2', async () => {

        params.answer.answer = '45.50';
        params.input_details.regex = '^[0-9]+$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('DECIMAL answer not matching regex 3', async () => {

        params.answer.answer = 0.000000025;
        params.input_details.regex = '^.{1,5}$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
        params.input_details.regex = '';
    });
    it('DECIMAL answer required but missing', async () => {

        params.answer.answer = '';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('DECIMAL answer unique', async () => {

        params.answer.answer = '4.8';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('DECIMAL answer NOT unique form', async () => {

        params.answer.answer = '2.7';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('DECIMAL answer NOT unique hierarchy', async () => {

        params.answer.answer = '89.75';
        params.input_details.uniqueness = 'hierarchy';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('DECIMAL answer double entry verification missing', async () => {

        params.answer.answer = '4.6';
        params.confirmAnswer.answer = '';
        params.input_details.verify = true;

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
        params.input_details.verify = false;
        params.confirmAnswer.answer = '';
    });

    it('DECIMAL answer double entry verification not matching', async () => {

        params.answer.answer = '6.7';
        params.confirmAnswer.answer = '-6.7';
        params.input_details.verify = true;

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
        params.input_details.verify = false;
        params.confirmAnswer.answer = '';
    });
    it('DECIMAL answer double entry verification matching', async () => {

        params.answer.answer = '0.25';
        params.confirmAnswer.answer = '0.25';
        params.input_details.verify = true;
        expect.assertions(2);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});
        params.input_details.verify = false;
        params.confirmAnswer.answer = '';
    });

    it('DECIMAL answer min', async () => {

        params.answer.answer = '1.6';
        params.input_details.min = '1';
        params.input_details.max = '';
        expect.assertions(4);

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});

        params.input_details.min = '2';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_28": "Value outside range."
            [inputRef]: ['ec5_28']
        });
        params.input_details.min = '';
        params.input_details.max = '';
    });

    it('DECIMAL answer max', async () => {

        params.answer.answer = '4.95';
        params.input_details.min = '';
        params.input_details.max = '20';
        expect.assertions(4);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});

        params.input_details.max = '4';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_28": "Value outside range."
            [inputRef]: ['ec5_28']
        });
        params.input_details.min = '';
        params.input_details.max = '';
    });
    it('DECIMAL answer min max', async () => {

        params.answer.answer = '10.890';
        params.input_details.min = '0';
        params.input_details.max = '20';

        expect.assertions(6);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});

        params.input_details.min = '0';
        params.input_details.max = '4';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_28": "Value outside range."
            [inputRef]: ['ec5_28']
        });

        params.answer.answer = '-9.5';
        params.input_details.min = '0';
        params.input_details.max = '1';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_28": "Value outside range."
            [inputRef]: ['ec5_28']
        });
        params.input_details.min = '';
        params.input_details.max = '';

    });
});
