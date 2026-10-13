import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import DateTimeField from '@/components/DateTimeField.vue';
import { PARAMETERS } from '@/config';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        theme: 'light'
    }))
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => true)
    }
}));

vi.mock('@/services/utilities/datetime-picker-service', () => ({
    datetimePickerService: {
        isSupported: vi.fn(() => true),
        presentDate: vi.fn(),
        presentTime: vi.fn(),
        getLocale: vi.fn(() => 'en-US'),
        getTheme: vi.fn(() => 'light'),
        getWheelTheme: vi.fn(() => 'dark')
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getUserFormattedDate: vi.fn(() => 'formatted-date'),
        getUserFormattedTime: vi.fn(() => 'formatted-time'),
        getInputFormattedDate: vi.fn((value) => (value || '').substring(0, 10)),
        getInputFormattedTime: vi.fn(() => '14:30'),
        getPickerFormattedTime: vi.fn(() => '14:30:00'),
        getISODateOnly: vi.fn((value) => value + 'T00:00:00.000'),
        getISOTime: vi.fn(() => '1970-01-01T14:30:00.000'),
        getHoursColumnPicker: vi.fn(() => Array.from({ length: 24 }, (_, index) => ({
            description: index > 9 ? String(index) : '0' + String(index)
        }))),
        getMinutesColumnPicker: vi.fn(() => Array.from({ length: 60 }, (_, index) => ({
            description: index > 9 ? String(index) : '0' + String(index)
        }))),
        getSecondsColumnPicker: vi.fn(() => Array.from({ length: 60 }, (_, index) => ({
            description: index > 9 ? String(index) : '0' + String(index)
        })))
    }
}));

import { Capacitor } from '@capacitor/core';
import { datetimePickerService } from '@/services/utilities/datetime-picker-service';
import { utilsService } from '@/services/utilities/utils-service';

describe('DateTimeField.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        Capacitor.isNativePlatform.mockReturnValue(true);
        datetimePickerService.isSupported.mockReturnValue(true);
    });

    function factory(props = {}) {
        return mount(DateTimeField, {
            props: {
                type: 'date',
                answer: '',
                datetimeFormat: 'dd/MM/YYYY',
                ...props
            }
        });
    }

    it('renders a grid with picker button and clear icon on the side', () => {
        const wrapper = factory();
        expect(wrapper.find('ion-grid.datetime-field-grid').exists()).toBe(true);
        expect(wrapper.find('ion-row.ion-align-items-center').exists()).toBe(true);
        const buttons = wrapper.findAll('ion-button');
        expect(buttons.length).toBe(1);
        const pickerButton = wrapper.find('ion-button.datetime-picker-button');
        expect(pickerButton.classes()).toContain('question-action-button');
        expect(pickerButton.attributes('color')).toBe('secondary');
        expect(pickerButton.attributes('expand')).toBe('block');
        const clearIcon = wrapper.find('ion-icon.datetime-clear-icon');
        expect(clearIcon.exists()).toBe(true);
        //sized 36x36 via CSS (not the stock size prop)
        expect(clearIcon.attributes('size')).toBeUndefined();
    });

    it('flips the picker button to danger only when the field has an error', () => {
        const invalid = factory({ hasError: true });
        expect(invalid.find('.datetime-picker-button').attributes('color')).toBe('danger');

        const valid = factory();
        expect(valid.find('.datetime-picker-button').attributes('color')).toBe('secondary');
    });

    it('remounts the picker button when the error flips', async () => {
        //in-place updates (class or color) do not land on the rendered
        //custom element: the key forces a fresh element instead
        const wrapper = factory();
        const before = wrapper.find('.datetime-picker-button').element;
        await wrapper.setProps({ hasError: true });
        expect(wrapper.find('.datetime-picker-button').element).not.toBe(before);
    });

    it('hides the programmatic web input from keyboard and assistive tech', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        const wrapper = factory({ type: 'date', answer: '' });
        const input = wrapper.find('input.datetime-web-input');
        expect(input.attributes('tabindex')).toBe('-1');
        expect(input.attributes('aria-hidden')).toBe('true');
    });

    it('shows the picker icon pinned left with formatted value, empty when unanswered', () => {
        const empty = factory({ type: 'date', answer: '' });
        const pickerIcon = empty.find('.datetime-button-col > ion-icon.datetime-picker-icon');
        expect(pickerIcon.exists()).toBe(true);
        expect(pickerIcon.attributes('size')).toBe('small');
        expect(empty.find('.datetime-picker-button').text()).toBe('');

        const time = factory({ type: 'time', answer: '', datetimeFormat: PARAMETERS.TIME_FORMAT_3 });
        const timeIcon = time.find('.datetime-button-col > ion-icon.datetime-picker-icon');
        expect(timeIcon.exists()).toBe(true);
        /*
         * False positive (review): picker icon attribute comparison is meaningful — by design. See docs/known-review-false-positives.md
         * (`tests/unit/components/DateTimeField.spec.js`, picker icon attribute comparison).
         */
        expect(timeIcon.attributes('icon')).not.toBe(pickerIcon.attributes('icon'));

        const timeAnswered = factory({ type: 'time', answer: '1970-01-01T14:30:00.000', datetimeFormat: PARAMETERS.TIME_FORMAT_3 });
        expect(timeAnswered.find('.datetime-picker-button').text()).toContain('formatted-time');

        const answered = factory({ type: 'date', answer: '2026-10-09T00:00:00.000' });
        expect(answered.find('.datetime-picker-button').text()).toContain('formatted-date');
        expect(utilsService.getUserFormattedDate).toHaveBeenCalled();
    });

    it('opens the OS date picker on native and emits canonical change', async () => {
        datetimePickerService.presentDate.mockResolvedValueOnce('2026-10-09');
        const wrapper = factory({ type: 'date', answer: '' });

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(datetimePickerService.presentDate).toHaveBeenCalled();
        expect(utilsService.getISODateOnly).toHaveBeenCalledWith('2026-10-09', 'dd/MM/YYYY');
        expect(wrapper.emitted('change')[0]).toEqual(['2026-10-09T00:00:00.000']);
    });

    it('opens the OS time picker on native without seconds and emits canonical change', async () => {
        datetimePickerService.presentTime.mockResolvedValueOnce('14:30');
        const wrapper = factory({
            type: 'time',
            answer: '',
            datetimeFormat: PARAMETERS.TIME_FORMAT_3
        });

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(datetimePickerService.presentTime).toHaveBeenCalledWith(expect.objectContaining({
            is24Hour: true
        }));
        expect(utilsService.getISOTime).toHaveBeenCalled();
        expect(wrapper.emitted('change')).toBeTruthy();
    });

    it('requests a 12-hour picker for 12-hour time formats', async () => {
        datetimePickerService.presentTime.mockResolvedValueOnce('02:30');
        const wrapper = factory({
            type: 'time',
            answer: '',
            datetimeFormat: PARAMETERS.TIME_FORMAT_4
        });

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(datetimePickerService.presentTime).toHaveBeenCalledWith(expect.objectContaining({
            is24Hour: false
        }));
    });

    it('opens the Cordova wheel selector on native with seconds', async () => {
        const showSelector = vi.fn((config, onSuccess) => {
            onSuccess([
                { description: '14' },
                { description: '30' },
                { description: '05' }
            ]);
        });
        window.SelectorCordovaPlugin = { showSelector };

        const wrapper = factory({
            type: 'time',
            answer: '',
            datetimeFormat: PARAMETERS.TIME_FORMAT_1
        });

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(showSelector).toHaveBeenCalled();
        expect(showSelector.mock.calls[0][0]).toMatchObject({ theme: 'dark' });
        expect(utilsService.getISOTime).toHaveBeenCalled();
        expect(wrapper.emitted('change')).toBeTruthy();

        delete window.SelectorCordovaPlugin;
    });

    it('opens the browser picker on web via the hidden input', async () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        datetimePickerService.isSupported.mockReturnValue(false);

        const wrapper = factory({ type: 'date', answer: '' });
        const input = wrapper.find('input.datetime-web-input');
        expect(input.exists()).toBe(true);
        expect(input.attributes('type')).toBe('date');

        const showPicker = vi.fn();
        input.element.showPicker = showPicker;

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(showPicker).toHaveBeenCalled();
        expect(datetimePickerService.presentDate).not.toHaveBeenCalled();
    });

    it('adds step seconds to the web input for seconds formats only', async () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        datetimePickerService.isSupported.mockReturnValue(false);

        const seconds = factory({
            type: 'time',
            answer: '',
            datetimeFormat: PARAMETERS.TIME_FORMAT_1
        });
        expect(seconds.find('input.datetime-web-input').attributes('step')).toBe('1');

        const minutes = factory({
            type: 'time',
            answer: '',
            datetimeFormat: PARAMETERS.TIME_FORMAT_3
        });
        expect(minutes.find('input.datetime-web-input').attributes('step')).toBeUndefined();

        const date = factory({ type: 'date', answer: '' });
        expect(date.find('input.datetime-web-input').attributes('step')).toBeUndefined();
    });

    it('leaves the answer untouched when the picker is dismissed', async () => {
        datetimePickerService.presentDate.mockResolvedValueOnce(null);
        const wrapper = factory({ type: 'date', answer: '' });

        await wrapper.find('.datetime-picker-button').trigger('click');

        expect(wrapper.emitted('change')).toBeFalsy();
    });

    it('names empty picker buttons for assistive technology', () => {
        const emptyDate = factory({ type: 'date', answer: '' });
        expect(emptyDate.find('.datetime-picker-button').attributes('aria-label')).toBe('The date selected is: ');

        const emptyTime = factory({ type: 'time', answer: '', datetimeFormat: PARAMETERS.TIME_FORMAT_3 });
        expect(emptyTime.find('.datetime-picker-button').attributes('aria-label')).toBe('The time selected is: ');

        const answered = factory({ type: 'date', answer: '2026-10-09T00:00:00.000' });
        expect(answered.find('.datetime-picker-button').attributes('aria-label')).toBeUndefined();
    });

    it('emits clear when the clear control is pressed', async () => {
        const wrapper = factory({ type: 'date', answer: '2026-10-09T00:00:00.000' });

        await wrapper.find('ion-icon.datetime-clear-icon').trigger('click');

        expect(wrapper.emitted('clear')).toBeTruthy();
    });
});
