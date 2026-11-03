import { answerValidateService } from '@/services/validation/answer-validate-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { vi } from 'vitest';
import { PARAMETERS } from '@/config';
import { setActivePinia, createPinia } from 'pinia';
import { PHP_ONLY_REGEX_PATTERNS } from '@/helpers/php-only-regex-patterns';


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
        setActivePinia(createPinia());
    });
    afterEach(() => {
        //params is shared module state: a failed assertion must not leak a pattern
        //or a uniqueness setting into the next test
        params.input_details.regex = null;
        params.input_details.uniqueness = 'none';
    });
    it('TEXT answer too long', async () => {

        const type = params.input_details.type.toUpperCase();
        const maxLength = PARAMETERS.QUESTION_ANSWER_MAX_LENGTHS[type];
        params.answer.answer = ''.padStart(maxLength + 1, '#');

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_214": "Answer too long"
            [inputRef]: ['ec5_214']
        });
    });
    it('TEXT answer required is provided', async () => {

        params.answer.answer = 'Mirko';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('TEXT answer not matching regex 1', async () => {

        params.answer.answer = '5Mirko5';
        params.input_details.regex = 'a-zA-Z]*$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('TEXT answer not matching regex 2', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.regex = '^[0-9]+$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('TEXT answer not matching regex 3', async () => {

        params.answer.answer = ' Mirko Mirko Mirko Mirko Mirko Mirko Mirko Mirko';
        params.input_details.regex = '^.{1,20}$';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });
    });
    it('TEXT answer is validated with PCRE2', async () => {

        //valid in PHP/PCRE (possessive quantifier), invalid in JavaScript
        params.input_details.regex = '^[0-9]{3}+$';

        params.answer.answer = '123';
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});

        params.answer.answer = '12';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });

        params.input_details.regex = null;
    });
    it.each(PHP_ONLY_REGEX_PATTERNS)('TEXT answer enforces the $description', async ({ pattern, matches, rejects }) => {

        params.input_details.regex = pattern;

        params.answer.answer = matches;
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});

        params.answer.answer = rejects;
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });

        params.input_details.regex = null;
    });
    it('TEXT answer still enforces a valid regex after a PCRE-only one', async () => {

        params.input_details.regex = '^(?>a+)b$';
        params.answer.answer = 'aab';
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();

        params.input_details.regex = '^[0-9]+$';
        params.answer.answer = 'Mirko';
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_23": "Regex format not matched."
            [inputRef]: ['ec5_23']
        });

        params.input_details.regex = null;
    });
    it('TEXT answer with a malformed project pattern is accepted and warned once', async () => {

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        params.input_details.regex = '(';
        params.answer.answer = 'Mirko';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});

        params.answer.answer = 'Toni';
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();

        //warn once per pattern, not once per answer
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

        consoleWarnSpy.mockRestore();
        params.input_details.regex = null;
    });
    it('TEXT answer follows PCRE end-of-subject semantics', async () => {

        //PCRE's $ also matches before a trailing newline, JavaScript's does not
        params.input_details.regex = '^abc$';
        params.answer.answer = 'abc\n';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});

        params.input_details.regex = null;
    });
    it('TEXT answer required but missing', async () => {

        params.answer.answer = '';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_21": "Required answer is missing."
            [inputRef]: ['ec5_21']
        });
    });
    it('TEXT answer unique', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('TEXT answer NOT unique form', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('TEXT answer NOT unique hierarchy', async () => {

        params.answer.answer = 'Mirko';
        params.input_details.uniqueness = 'hierarchy';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('TEXT numeric answer unique', async () => {

        params.answer.answer = 1234;
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('TEXT numeric answer NOT unique', async () => {

        params.answer.answer = 1234;
        params.input_details.uniqueness = 'form';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [1, 2, 3] });

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_22": "Answer is not unique."
            [inputRef]: ['ec5_22']
        });
        params.input_details.uniqueness = 'none';
    });
    it('TEXT numeric answer uniqueness none', async () => {

        params.answer.answer = 1234;
        params.input_details.uniqueness = 'none';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('TEXT numeric answer uniqueness hierarchy', async () => {

        params.answer.answer = 1234;
        params.input_details.uniqueness = 'hierarchy';
        databaseSelectService.isUnique.mockResolvedValue({ rows: [] });

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
        params.input_details.uniqueness = 'none';
    });
    it('TEXT answer double entry verification missing', async () => {

        params.answer.answer = 'Mirko';
        params.confirmAnswer.answer = '';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('TEXT answer double entry verification case sensitive', async () => {

        params.answer.answer = 'Mirko';
        params.confirmAnswer.answer = 'MiRKo';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('TEXT answer double entry verification not matching', async () => {

        params.answer.answer = 'Toni';
        params.confirmAnswer.answer = 'Bepi';
        params.input_details.verify = 'true';

        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_124": "Answers not equal."
            [inputRef]: ['ec5_124']
        });
    });
    it('TEXT answer double entry verification matching', async () => {

        params.answer.answer = 'Cats';
        params.confirmAnswer.answer = 'Cats';
        params.input_details.verify = 'true';
        expect.assertions(2);
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toStrictEqual({});
    });
});
