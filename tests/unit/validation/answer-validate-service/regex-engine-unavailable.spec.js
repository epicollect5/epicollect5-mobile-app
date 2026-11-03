import { answerValidateService } from '@/services/validation/answer-validate-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

//unsupported WebView / blocked WASM: the service reports itself unavailable
vi.mock('@/services/validation/regex-service', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        regexService: {
            ...actual.regexService,
            isAvailable: vi.fn().mockResolvedValue(false)
        }
    };
});

vi.mock('@/services/database/database-select-service', () => {
    const databaseSelectService = vi.fn();
    databaseSelectService.isUnique = vi.fn();
    return { databaseSelectService };
});

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_62fa24caa1b10';
const entry = {
    entryUuid: '75523045-1954-4a3e-adc3-91500d5c65c4',
    formRef: '70dcdb0b606843989674d3851c544f23_62fa24c5161be',
    parentFormRef: '',
    projectRef: '70dcdb0b606843989674d3851c544f23',
    branchEntries: {},
    media: {},
    uniqueAnswers: {},
    isBranch: false,
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

describe('answerValidateService without PCRE2', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('does not enforce patterns JavaScript could evaluate', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        //identical in both engines: still skipped, as JavaScript cannot stand in for PCRE
        params.input_details.regex = '^[0-9]+$';
        params.answer.answer = 'Mirko';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toEqual({});
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

        consoleWarnSpy.mockRestore();
        params.input_details.regex = null;
    });

    it('does not enforce patterns JavaScript cannot compile, and warns once per pattern', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        //valid in PHP/PCRE, SyntaxError in JavaScript
        params.input_details.regex = '^[0-9]{3}+$';

        params.answer.answer = '12';
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toEqual({});

        params.answer.answer = '123';
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toEqual({});

        //warned once for the pattern, not once per answer
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

        consoleWarnSpy.mockRestore();
        params.input_details.regex = null;
    });

    it('does not enforce patterns through their JavaScript reading', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        //\A and \z anchor in PCRE, so "abc" is a match there; JavaScript reads
        //them as literal characters and would reject it. Only the skip can accept
        //this answer, so a JavaScript fallback cannot pass this test
        params.input_details.regex = '^\\Aabc\\z$';
        params.answer.answer = 'abc';

        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toEqual({});
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

        consoleWarnSpy.mockRestore();
        params.input_details.regex = null;
    });
});
