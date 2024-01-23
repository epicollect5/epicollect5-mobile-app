import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';
import { databaseSelectService } from '@/services/database/database-select-service';

describe('UUID', () => {
    it('should be valid UUID v4', () => {
        const uuid = utilsService.uuid();
        const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
        expect(regexExp.test(uuid)).toBe(true);
    });
});

describe('Date', () => {
    it('getInputFormattedDate()', () => {
        let date = '2022-08-10T00:00:00.000';
        let inputFormattedDate = utilsService.getInputFormattedDate(date);
        expect(inputFormattedDate).toBe('2022-08-10');

        date = '2022-01-01T00:00:00.000';
        inputFormattedDate = utilsService.getInputFormattedDate(date);
        expect(inputFormattedDate).toBe('2022-01-01');

        date = '1987-12-29T00:00:00.000';
        inputFormattedDate = utilsService.getInputFormattedDate(date);
        expect(inputFormattedDate).toBe('1987-12-29');
    });

    it('getISODateTime()', () => {

        let date = new Date(Date.UTC(1998, 4, 22, 14, 45, 56, 345));

        vi.useFakeTimers();
        vi.setSystemTime(date);

        let result = utilsService.getISODateTime();
        expect(result).toBe('1998-05-22T14:45:56.000Z');

        date = new Date(Date.UTC(2024, 11, 13, 0, 5, 11, 1));

        vi.useFakeTimers();
        vi.setSystemTime(date);

        result = utilsService.getISODateTime();
        expect(result).toBe('2024-12-13T00:05:11.000Z');

        vi.useRealTimers();
    });

    it('getISODateOnly()', () => {

        let date = new Date(Date.UTC(1998, 4, 22, 14, 45, 56, 345));

        vi.useFakeTimers();
        vi.setSystemTime(date);

        let result = utilsService.getISODateOnly(date.toISOString());
        expect(result).toBe('1998-05-22T00:00:00.000');

        date = new Date(Date.UTC(2024, 11, 13, 0, 5, 11, 1));

        vi.useFakeTimers();
        vi.setSystemTime(date);

        result = utilsService.getISODateOnly(date.toISOString());
        expect(result).toBe('2024-12-13T00:00:00.000');

        vi.useRealTimers();
    });
});

describe('Time', () => {
    it('getInputFormattedTime()', () => {
        //"1970-01-01T01:03:00.000"
        const time = '1970-01-01T01:03:27.000';
        let format = PARAMETERS.TIME_FORMAT_1;
        let inputFormattedTime = utilsService.getInputFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_2;
        inputFormattedTime = utilsService.getInputFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_3;
        inputFormattedTime = utilsService.getInputFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03');

        format = PARAMETERS.TIME_FORMAT_4;
        inputFormattedTime = utilsService.getInputFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03');

        format = PARAMETERS.TIME_FORMAT_5;
        inputFormattedTime = utilsService.getInputFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');
    });

    it('getPickerFormattedTime()', () => {
        //"1970-01-01T01:03:00.000"
        const time = '1970-01-01T01:03:27.000';
        let format = PARAMETERS.TIME_FORMAT_1;
        let inputFormattedTime = utilsService.getPickerFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_2;
        inputFormattedTime = utilsService.getPickerFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_3;
        inputFormattedTime = utilsService.getPickerFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_4;
        inputFormattedTime = utilsService.getPickerFormattedTime(time, format);
        expect(inputFormattedTime).toBe('01:03:27');

        format = PARAMETERS.TIME_FORMAT_5;
        inputFormattedTime = utilsService.getPickerFormattedTime(time, format);
        expect(inputFormattedTime).toBe('03:27');
    });

    it('getUserFormattedTime()', () => {
        //"1970-01-01T01:03:00.000"
        let time = '1970-01-01T23:03:27.000';
        let format = PARAMETERS.TIME_FORMAT_1;
        let inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('23:03:27');

        format = PARAMETERS.TIME_FORMAT_2;
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('11:03:27 PM');

        time = '1970-01-01T08:03:27.000';
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('08:03:27 AM');


        format = PARAMETERS.TIME_FORMAT_3;
        time = '1970-01-01T08:03:27.000';
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('08:03');

        format = PARAMETERS.TIME_FORMAT_4;
        time = '1970-01-01T16:03:27.000';
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('04:03 PM');

        time = '1970-01-01T02:03:27.000';
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('02:03 AM');

        time = '1970-01-01T02:32:27.000';
        format = PARAMETERS.TIME_FORMAT_5;
        inputFormattedTime = utilsService.getUserFormattedTime(time, format);
        expect(inputFormattedTime).toBe('32:27');
    });

    it('getUserFormattedDate()', () => {
        let date = '1970-01-01T23:03:27.000';
        let format = PARAMETERS.DATE_FORMAT_1;
        let result = utilsService.getUserFormattedDate(date, format);
        expect(result).toBe('01/01/1970');

        date = '2022-04-18T23:03:27.000';
        format = PARAMETERS.DATE_FORMAT_2;
        result = utilsService.getUserFormattedDate(date, format);
        expect(result).toBe('04/18/2022');

        format = PARAMETERS.DATE_FORMAT_3;
        date = '2022-04-18T23:03:27.000';
        result = utilsService.getUserFormattedDate(date, format);
        expect(result).toBe('2022/04/18');

        format = PARAMETERS.DATE_FORMAT_4;
        date = '2022-04-18T23:03:27.000';
        result = utilsService.getUserFormattedDate(date, format);
        expect(result).toBe('04/2022');

        date = '1970-01-16T02:32:27.000';
        format = PARAMETERS.DATE_FORMAT_5;
        result = utilsService.getUserFormattedDate(date, format);
        expect(result).toBe('16/01');
    });

    it('getISOTime()', () => {
        const date = new Date(1998, 4, 22, 14, 45, 56, 345);

        vi.useFakeTimers();
        vi.setSystemTime(date);

        const result = utilsService.getISOTime(date);
        expect(result).toBe('1998-05-22T14:45:56.000');

        vi.useRealTimers();
    });

    it('toISOStringLocale()', () => {
        vi.useFakeTimers();

        let date = new Date(2023, 4, 22, 14, 45, 56, 345);
        vi.setSystemTime(date);

        let result = utilsService.getISOTime(date);
        expect(result).toBe('2023-05-22T14:45:56.000');

        date = new Date(2023, 4, 22, 0, 45, 56, 345);
        vi.setSystemTime(date);
        result = utilsService.getISOTime(date);
        expect(result).toBe('2023-05-22T00:45:56.000');

        date = new Date(2023, 4, 22, 10, 45, 56, 345);
        vi.setSystemTime(date);
        result = utilsService.getISOTime(date);
        expect(result).toBe('2023-05-22T10:45:56.000');

        date = new Date(2023, 4, 22, 23, 59, 59, 999);
        vi.setSystemTime(date);
        result = utilsService.getISOTime(date);
        expect(result).toBe('2023-05-22T23:59:59.000');

        vi.useRealTimers();
    });
});

describe('Filename', () => {
    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('generateMediaFilename()', () => {

        const rootStore = useRootStore();

        //ANDROID
        rootStore.device.platform = PARAMETERS.ANDROID;

        const uuid = utilsService.uuid();
        let type = PARAMETERS.QUESTION_TYPES.PHOTO;
        let ext = PARAMETERS.PHOTO_EXT;
        let filename = utilsService.generateMediaFilename(uuid, type);
        expect(filename.startsWith(uuid + '_')).toBe(true);
        expect(filename.endsWith(ext)).toBe(true);

        type = PARAMETERS.QUESTION_TYPES.AUDIO;
        ext = PARAMETERS.AUDIO_EXT;
        filename = utilsService.generateMediaFilename(uuid, type);
        expect(filename.startsWith(uuid + '_')).toBe(true);
        expect(filename.endsWith(ext)).toBe(true);
        expect(filename.endsWith(PARAMETERS.AUDIO_EXT_IOS)).toBe(false);

        type = PARAMETERS.QUESTION_TYPES.VIDEO;
        ext = PARAMETERS.VIDEO_EXT;
        filename = utilsService.generateMediaFilename(uuid, type);
        expect(filename.startsWith(uuid + '_')).toBe(true);
        expect(filename.endsWith(ext)).toBe(true);
        expect(filename).toHaveLength((uuid + '_' + utilsService.generateTimestamp() + ext).length);

        //IOS (only audio ext is different)
        rootStore.device.platform = PARAMETERS.IOS;
        type = PARAMETERS.QUESTION_TYPES.AUDIO;
        ext = PARAMETERS.AUDIO_EXT;
        filename = utilsService.generateMediaFilename(uuid, type);
        expect(filename.startsWith(uuid + '_')).toBe(true);
        expect(filename.endsWith(ext)).toBe(false);
        expect(filename.endsWith(PARAMETERS.AUDIO_EXT_IOS)).toBe(true);
    });
});

describe('isValidDecimalDegreesString', () => {
    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('Valid coords', () => {

        let coords = '-77.508333, 164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(true);

        coords = '-77.50833, 164.75416';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(true);

        coords = '-77, 164';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(true);

        //valid, will be rounded to 6 decinmal places
        coords = '-77.5083633, 164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(true);

        for (let i = 0; i < 500; i++) {

            const lat = utilsService.getRandomInRange(-90, 90, 5);
            const long = utilsService.getRandomInRange(-180, 180, 5);
            coords = lat + ',' + long;
            expect(utilsService.isValidDecimalDegreesString(coords)).toBe(true);
        }
    });

    it('Invalid coords', () => {

        let coords = '-77.508333';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = 'adkjskjasjkd';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = 'me, too';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = '-77.508333 164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = '-77.508333 - 164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);



        coords = ',-77.508333 ,164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = '2000 ,164.754167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = '-77.508333 ,190';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

        coords = '-77.508333 ,164.#54167';
        expect(utilsService.isValidDecimalDegreesString(coords)).toBe(false);

    });
});

describe('getSanitisedAnswer', () => {
    it('should sanitise input by replacing < and > with unicode', () => {
        // Input values with < and > characters
        const inputValue1 = 'Hello<World';
        const inputValue2 = 'Test>String';

        // Call the function with input values
        const result1 = utilsService.getSanitisedAnswer(inputValue1);
        const result2 = utilsService.getSanitisedAnswer(inputValue2);

        // Assert the sanitised results
        expect(result1).toBe('Hello\ufe64World');
        expect(result2).toBe('Test\ufe65String');
    });

    it('should trim input before sanitising', () => {
        // Input value with extra spaces
        const inputValue = '   Trim This   ';

        // Call the function with input value
        const result = utilsService.getSanitisedAnswer(inputValue);

        // Assert the trimmed and sanitised result
        expect(result).toBe('Trim This');
    });
    it('should trim input before sanitising', () => {
        // Input value with extra spaces
        const inputValue = '   <Trim This>   ';

        // Call the function with input value
        const result = utilsService.getSanitisedAnswer(inputValue);

        // Assert the trimmed and sanitised result
        expect(result).toBe('\ufe64Trim This\ufe65');
    });
    it('should not affect Unicode characters', () => {
        // Input value with Unicode characters
        const unicodeValue = 'Unicode \u2600\u2714 Characters';

        // Call the function with Unicode input
        const result = utilsService.getSanitisedAnswer(unicodeValue);

        // Assert that Unicode characters are not affected
        expect(result).toBe(unicodeValue);
    });
});

describe('getStepPrecision', () => {
    it('should return a step value with the specified precision', () => {
        // Test with different precisions
        const precision1 = 1;
        const precision2 = 2;
        const precision3 = 3;

        // Call the function with different precisions
        const result1 = utilsService.getStepPrecision(precision1);
        const result2 = utilsService.getStepPrecision(precision2);
        const result3 = utilsService.getStepPrecision(precision3);

        // Assert the step values with expected precision
        expect(result1).toBe(0.1);
        expect(result2).toBe(0.01);
        expect(result3).toBe(0.001);
    });
});

describe('buildPossibleAnswersHashMap', () => {
    it('should build a hashmap with answer references as keys', () => {
        // Sample possibleAnswers data for testing

        const A = utilsService.generateUniqID();
        const B = utilsService.generateUniqID();
        const C = utilsService.generateUniqID();

        const possibleAnswers = [
            { answer_ref: A, answer: 'Option A' },
            { answer_ref: B, answer: 'Option B' },
            { answer_ref: C, answer: 'Option C' }
        ];

        // Call the function with sample possibleAnswers data
        const result = utilsService.buildPossibleAnswersHashMap(possibleAnswers);

        // Assert the generated hashmap
        expect(result).toEqual({
            [A]: 'Option A',
            [B]: 'Option B',
            [C]: 'Option C'
        });
    });
});

describe('getHoursColumnPicker', () => {
    it('should return an array of hours with descriptions', () => {
        // Expected array of objects representing hours with descriptions
        const expectedHours = [
            { description: '00' },
            { description: '01' },
            { description: '02' },
            { description: '03' },
            { description: '04' },
            { description: '05' },
            { description: '06' },
            { description: '07' },
            { description: '08' },
            { description: '09' },
            { description: '10' },
            { description: '11' },
            { description: '12' },
            { description: '13' },
            { description: '14' },
            { description: '15' },
            { description: '16' },
            { description: '17' },
            { description: '18' },
            { description: '19' },
            { description: '20' },
            { description: '21' },
            { description: '22' },
            { description: '23' }
        ];

        // Call the function to get the hours column picker
        const result = utilsService.getHoursColumnPicker();

        // Assert the generated hours column picker
        expect(result).toEqual(expectedHours);
    });
});
describe('getMinutesColumnPicker', () => {
    it('should return an array of minutes with descriptions', () => {
        // Expected array of objects representing minutes with descriptions
        const expectedMinutes = [
            { description: '00' },
            { description: '01' },
            { description: '02' },
            { description: '03' },
            { description: '04' },
            { description: '05' },
            { description: '06' },
            { description: '07' },
            { description: '08' },
            { description: '09' },
            { description: '10' },
            { description: '11' },
            { description: '12' },
            { description: '13' },
            { description: '14' },
            { description: '15' },
            { description: '16' },
            { description: '17' },
            { description: '18' },
            { description: '19' },
            { description: '20' },
            { description: '21' },
            { description: '22' },
            { description: '23' },
            { description: '24' },
            { description: '25' },
            { description: '26' },
            { description: '27' },
            { description: '28' },
            { description: '29' },
            { description: '30' },
            { description: '31' },
            { description: '32' },
            { description: '33' },
            { description: '34' },
            { description: '35' },
            { description: '36' },
            { description: '37' },
            { description: '38' },
            { description: '39' },
            { description: '40' },
            { description: '41' },
            { description: '42' },
            { description: '43' },
            { description: '44' },
            { description: '45' },
            { description: '46' },
            { description: '47' },
            { description: '48' },
            { description: '49' },
            { description: '50' },
            { description: '51' },
            { description: '52' },
            { description: '53' },
            { description: '54' },
            { description: '55' },
            { description: '56' },
            { description: '57' },
            { description: '58' },
            { description: '59' }
        ];

        // Call the function to get the minutes column picker
        const result = utilsService.getMinutesColumnPicker();

        // Assert the generated minutes column picker
        expect(result).toEqual(expectedMinutes);
    });
});

describe('isJWTExpired', () => {
    it('should resolve to true if no JWT is found', async () => {
        databaseSelectService.getUser = vi.fn().mockResolvedValue(
            {
                rows: { length: 0 }
            });

        // Call the function to check if JWT is expired
        const result = await utilsService.isJWTExpired();

        // Assert the result
        expect(result).toBe(true);
        expect(databaseSelectService.getUser).toHaveBeenCalled();
    });
});

describe('trunc', () => {
    it('should truncate string to desired length with ...', () => {

        // Call the function to get the minutes column picker
        let result = utilsService.trunc('This is a long string', 5, true);
        // Assert the generated minutes column picker
        expect(result).toEqual('Th...');

        for (let i = 51; i < 100; i++) {
            const str = utilsService.generateRandomString(i);
            result = utilsService.trunc(str, 50, true);
            expect(result.length).toBe(50);
            expect(result.endsWith('...')).toBe(true);
        }
        for (let i = 0; i < 50; i++) {
            const randomStringLength = Math.floor(Math.random() * 100) + 1;
            const truncatedLength = Math.floor(Math.random() * 100) + 1;

            const randomString = utilsService.generateRandomString(randomStringLength);
            const truncatedString = utilsService.trunc(randomString, truncatedLength, true);

            expect(truncatedString.length).toBeLessThanOrEqual(truncatedLength);
            expect(truncatedString.endsWith('...')).toBe(truncatedLength < randomStringLength && truncatedLength >= 3);
        }
    });

    it('should truncate string to desired length without ...', () => {

        // Call the function to get the minutes column picker
        let result = utilsService.trunc('This is a long string', 5, false);
        // Assert the generated minutes column picker
        expect(result).toEqual('This ');

        for (let i = 51; i < 100; i++) {
            const str = utilsService.generateRandomString(i);
            result = utilsService.trunc(str, 50, false);
            expect(result.length).toBe(50);
            expect(result.endsWith('...')).toBe(false);
        }
        for (let i = 0; i < 50; i++) {
            const randomStringLength = Math.floor(Math.random() * 100) + 1;
            const truncatedLength = Math.floor(Math.random() * 100) + 1;

            const randomString = utilsService.generateRandomString(randomStringLength);
            const truncatedString = utilsService.trunc(randomString, truncatedLength, false);

            expect(truncatedString.length).toBeLessThanOrEqual(truncatedLength);
            expect(truncatedString.endsWith('...')).toBe(false);
        }
    });
});







