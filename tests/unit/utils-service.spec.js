import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';

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