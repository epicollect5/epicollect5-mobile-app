import { answerValidateService } from '@/services/validation/answer-validate-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { vi } from 'vitest';
import { PARAMETERS } from '@/config';

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_62fa24caa1b10';
const formats = [
    PARAMETERS.DATE_FORMAT_1,
    PARAMETERS.DATE_FORMAT_2,
    PARAMETERS.DATE_FORMAT_3,
    PARAMETERS.DATE_FORMAT_4,
    PARAMETERS.DATE_FORMAT_5
];
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
        type: 'date',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: null,
        is_title: true,
        question: 'Birthday ?',
        uniqueness: 'none',
        is_required: true,
        datetime_format: 'dd/MM/YYYY',
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
    it('DATE answer too long', async () => {

        const type = params.input_details.type.toUpperCase();
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type];
        params.answer.answer = ''.padStart(maxLength + 1, '#');

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_214": "Answer too long"
            [inputRef]: ['ec5_214']
        });
    });
    it('DATE answer required is provided', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });

    it('DATE answer required but missing', async () => {

        params.answer.answer = '';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('DATE answer unique', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.input_details.uniqueness = 'form';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('DATE answer NOT unique form', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.input_details.uniqueness = 'form';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('DATE answer NOT unique hierarchy', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.input_details.uniqueness = 'hierarchy';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('DATE answer double entry verification missing', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.confirmAnswer.answer = '';
        params.input_details.verify = 'true';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('DATE answer double entry verification case sensitive', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.confirmAnswer.answer = '2022-08-17t00:00:00.000';
        params.input_details.verify = 'true';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('DATE answer double entry verification not matching', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.confirmAnswer.answer = '2022-08-19T00:00:00.000';
        params.input_details.verify = 'true';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('DATE answer double entry verification matching', async () => {

        params.answer.answer = '2022-08-17T00:00:00.000';
        params.confirmAnswer.answer = '2022-08-17T00:00:00.000';
        params.input_details.verify = 'true';
        params.input_details.datetime_format = formats[Math.floor(Math.random() * formats.length)];
        expect.assertions(2);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});
    });
});
