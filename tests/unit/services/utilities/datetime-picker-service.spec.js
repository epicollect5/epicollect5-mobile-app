import { describe, it, expect, beforeEach, vi } from 'vitest';

const isNativeState = vi.hoisted(() => ({ value: true }));
const presentMock = vi.hoisted(() => vi.fn());

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => isNativeState.value)
    }
}));

vi.mock('@capawesome-team/capacitor-datetime-picker', () => ({
    DatetimePicker: {
        present: presentMock
    }
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        theme: 'light'
    }))
}));

import { datetimePickerService } from '@/services/utilities/datetime-picker-service';
import { Capacitor } from '@capacitor/core';
import { DatetimePicker } from '@capawesome-team/capacitor-datetime-picker';

describe('datetime-picker-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isNativeState.value = true;
    });

    it('isSupported mirrors Capacitor.isNativePlatform', () => {
        isNativeState.value = true;
        expect(datetimePickerService.isSupported()).toBe(true);
        expect(Capacitor.isNativePlatform).toHaveBeenCalled();

        isNativeState.value = false;
        expect(datetimePickerService.isSupported()).toBe(false);
    });

    it('presentDate maps options and returns the picked value', async () => {
        presentMock.mockResolvedValueOnce({ value: '2026-10-09' });

        const value = await datetimePickerService.presentDate({
            value: '2026-10-09',
            min: '2026-01-01',
            max: '2026-12-31',
            locale: 'en-US',
            theme: 'light'
        });

        expect(value).toBe('2026-10-09');
        expect(DatetimePicker.present).toHaveBeenCalledWith({
            mode: 'date',
            format: 'yyyy-MM-dd',
            value: '2026-10-09',
            min: '2026-01-01',
            max: '2026-12-31',
            locale: 'en-US',
            theme: 'light'
        });
    });

    it('presentTime maps options and returns the picked value', async () => {
        presentMock.mockResolvedValueOnce({ value: '14:30' });

        const value = await datetimePickerService.presentTime({
            value: '14:30',
            locale: 'en-US',
            theme: 'dark'
        });

        expect(value).toBe('14:30');
        expect(DatetimePicker.present).toHaveBeenCalledWith({
            mode: 'time',
            format: 'HH:mm',
            value: '14:30',
            locale: 'en-US',
            theme: 'dark'
        });
    });

    it('resolves null when the user dismisses the picker', async () => {
        presentMock.mockRejectedValueOnce({ code: 'dismissed' });
        const dateValue = await datetimePickerService.presentDate({ value: '2026-10-09' });
        expect(dateValue).toBeNull();

        presentMock.mockRejectedValueOnce({ message: 'canceled' });
        const timeValue = await datetimePickerService.presentTime({ value: '14:30' });
        expect(timeValue).toBeNull();
    });

    it('detects dismissal text in the message despite a non-dismissal code', async () => {
        presentMock.mockRejectedValueOnce({ code: 'OS-PLUG-0001', message: 'dismissed by the user' });
        const value = await datetimePickerService.presentDate({ value: '2026-10-09' });
        expect(value).toBeNull();
        expect(DatetimePicker.present).toHaveBeenCalled();
    });

    it('rethrows non-dismissal errors', async () => {
        presentMock.mockRejectedValueOnce(new Error('boom'));
        await expect(datetimePickerService.presentDate({ value: '2026-10-09' })).rejects.toThrow('boom');
    });

    it('is a no-op when not on a native platform', async () => {
        isNativeState.value = false;

        const dateValue = await datetimePickerService.presentDate({ value: '2026-10-09' });
        const timeValue = await datetimePickerService.presentTime({ value: '14:30' });

        expect(dateValue).toBeNull();
        expect(timeValue).toBeNull();
        expect(DatetimePicker.present).not.toHaveBeenCalled();
    });

    it('maps app language to BCP47 and theme to picker theme', async () => {
        expect(datetimePickerService.toBCP47('en')).toBe('en-US');
        expect(datetimePickerService.toBCP47('fr')).toBe('fr-FR');
        expect(datetimePickerService.getLocale()).toBe('en-US');
        expect(datetimePickerService.getTheme()).toBe('light');

        const { useRootStore } = await import('@/stores/root-store');
        useRootStore.mockReturnValue({ language: 'en', theme: 'dark' });
        expect(datetimePickerService.getTheme()).toBe('dark');

        useRootStore.mockReturnValue({ language: 'en', theme: 'system' });
        expect(datetimePickerService.getTheme()).toBe('auto');

        presentMock.mockResolvedValueOnce({ value: '2026-10-09' });
        await datetimePickerService.presentDate({ value: '2026-10-09' });
        expect(DatetimePicker.present).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'date',
            locale: 'en-US',
            theme: 'auto'
        }));
    });

    it('resolves the wheel theme to the effective light/dark value', async () => {
        const { useRootStore } = await import('@/stores/root-store');

        useRootStore.mockReturnValue({ language: 'en', theme: 'dark' });
        expect(datetimePickerService.getWheelTheme()).toBe('dark');

        useRootStore.mockReturnValue({ language: 'en', theme: 'light' });
        expect(datetimePickerService.getWheelTheme()).toBe('light');

        useRootStore.mockReturnValue({ language: 'en', theme: 'system' });
        window.matchMedia = vi.fn(() => ({ matches: true }));
        expect(datetimePickerService.getWheelTheme()).toBe('dark');
        window.matchMedia = vi.fn(() => ({ matches: false }));
        expect(datetimePickerService.getWheelTheme()).toBe('light');
    });

    it('requests a 24-hour locale for 24-hour time formats', async () => {
        presentMock.mockResolvedValueOnce({ value: '14:30' });
        await datetimePickerService.presentTime({ value: '14:30', locale: 'en-US', is24Hour: true });
        expect(DatetimePicker.present).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'time',
            locale: 'en-GB'
        }));

        presentMock.mockResolvedValueOnce({ value: '02:30' });
        await datetimePickerService.presentTime({ value: '02:30', locale: 'en-US' });
        expect(DatetimePicker.present).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'time',
            locale: 'en-US'
        }));

        presentMock.mockResolvedValueOnce({ value: '14:30' });
        await datetimePickerService.presentTime({ value: '14:30', locale: 'fr-FR', is24Hour: true });
        expect(DatetimePicker.present).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'time',
            locale: 'fr-FR'
        }));
    });
});
