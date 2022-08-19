import { answerValidateService } from '@/services/validation/answer-validate-service';
import { vi } from 'vitest';
import { utilsService } from '@/services/utilities/utils-service';

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

const params =
{
    input_details: {
        max: null,
        min: null,
        ref: inputRef,
        type: 'location',
        group: [],
        jumps: [],
        regex: null,
        branch: [],
        verify: false,
        default: null,
        is_title: false,
        question: 'Your Location ?',
        uniqueness: 'none',
        is_required: false,
        datetime_format: null,
        possible_answers: [],
        set_to_current_datetime: false
    },
    answer: {
        was_jumped: false,
        answer: {
            latitude: '45.900671',
            longitude: '12.004856',
            accuracy: 8
        }
    },
    confirmAnswer: {
        verify: false,
        answer: {
            latitude: '45.900671',
            longitude: '12.004856',
            accuracy: 8
        }
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
    it('LOCATION answer objects valid (100 times)', async () => {

        for (let i = 0; i < 100; i++) {
            const lat = utilsService.getRandomInRange(-180, 180, 5);
            const lng = utilsService.getRandomInRange(-90, 90, 5);
            params.answer.answer = utilsService.getRandomLocation(lat, lng);

            await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
            expect(answerValidateService.getErrors()).toMatchObject({});
        }
    });
    it('LOCATION answer empty object valid', async () => {

        params.answer.answer = {
            latitude: '',
            longitude: '',
            accuracy: ''
        };
        await expect(answerValidateService.validate(entry, params)).resolves.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({});
    });
    it('LOCATION answer missing latitude', async () => {

        params.answer.answer = {
            latitude: '',
            longitude: '12.004856',
            accuracy: 8
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });
    });

    it('LOCATION answer missing longitude', async () => {

        params.answer.answer = {
            latitude: '45.900671',
            longitude: '',
            accuracy: 8
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });
    });

    it('LOCATION answer missing accuracy', async () => {

        params.answer.answer = {
            latitude: '45.900671',
            longitude: '',
            accuracy: ''
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });
    });

    it('LOCATION answer object invalid', async () => {

        params.answer.answer = {
            latitude: '45.90067',//must be 6 decimals
            longitude: '12.004856',
            accuracy: 8
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '45.900679',
            longitude: '12.04856',//must be 6 decimals
            accuracy: 8
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '45.900679',
            longitude: '12.04856',
            accuracy: -89//must be positive
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '45.900679768', //must be 6 decimal
            longitude: '12.04856',
            accuracy: 4
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '45.900679',
            longitude: '12.04856966', //must be 6 decimal
            accuracy: 7
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '45.900679',
            longitude: '129048569', //must have .
            accuracy: 7
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });

        params.answer.answer = {
            latitude: '457900679',//must have .
            longitude: '12.948569',
            accuracy: 7
        };
        await expect(answerValidateService.validate(entry, params)).rejects.toEqual();
        expect(answerValidateService.getErrors()).toMatchObject({
            //"ec5_30": "Location data not valid"
            [inputRef]: ['ec5_30']
        });
    });

});
