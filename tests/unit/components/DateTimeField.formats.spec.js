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
        getTheme: vi.fn(() => 'light')
    }
}));

describe('DateTimeField.vue - button text with real formatters', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    function labelFor(props) {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'date',
                answer: '',
                datetimeFormat: '',
                ...props
            }
        });
        return wrapper.find('.datetime-picker-button').text();
    }

    it.each([
        [PARAMETERS.DATE_FORMAT_1, '09/10/2026'],
        [PARAMETERS.DATE_FORMAT_2, '10/09/2026'],
        [PARAMETERS.DATE_FORMAT_3, '2026/10/09'],
        [PARAMETERS.DATE_FORMAT_4, '10/2026'],
        [PARAMETERS.DATE_FORMAT_5, '09/10']
    ])('renders date format %s as %s', (datetimeFormat, expected) => {
        expect(labelFor({
            type: 'date',
            answer: '2026-10-09T00:00:00.000',
            datetimeFormat
        })).toContain(expected);
    });

    it.each([
        [PARAMETERS.TIME_FORMAT_1, '14:30:05'],
        [PARAMETERS.TIME_FORMAT_2, '02:30:05 PM'],
        [PARAMETERS.TIME_FORMAT_3, '14:30'],
        [PARAMETERS.TIME_FORMAT_4, '02:30 PM'],
        [PARAMETERS.TIME_FORMAT_5, '30:05']
    ])('renders time format %s as %s', (datetimeFormat, expected) => {
        expect(labelFor({
            type: 'time',
            answer: '2026-10-09T14:30:05.000',
            datetimeFormat
        })).toContain(expected);
    });

    it('falls back to raw values without a datetime format', () => {
        expect(labelFor({
            type: 'date',
            answer: '2026-10-09'
        })).toContain('2026-10-09');
        expect(labelFor({
            type: 'time',
            answer: '14:30'
        })).toContain('14:30');
    });

    it('renders empty when unanswered', () => {
        expect(labelFor({ type: 'date', answer: '' })).toBe('');
        expect(labelFor({ type: 'time', answer: '' })).toBe('');
    });

    it('passes seconds-capable values to the web input', () => {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'time',
                answer: '2026-10-09T14:30:05.000',
                datetimeFormat: PARAMETERS.TIME_FORMAT_1
            }
        });
        const input = wrapper.find('input.datetime-web-input');
        expect(input.attributes('step')).toBe('1');
        expect(input.element.value).toBe('14:30:05');
    });

    it('saves web date input as canonical answers', async () => {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'date',
                answer: '',
                datetimeFormat: PARAMETERS.DATE_FORMAT_1
            }
        });
        const input = wrapper.find('input.datetime-web-input');
        input.element.value = '2026-10-09';
        await input.trigger('change');
        expect(wrapper.emitted('change')[0]).toEqual(['2026-10-09T00:00:00.000']);
    });

    it('saves web minute-only time input as canonical answers', async () => {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'time',
                answer: '',
                datetimeFormat: PARAMETERS.TIME_FORMAT_3
            }
        });
        const input = wrapper.find('input.datetime-web-input');
        input.element.value = '14:30';
        await input.trigger('change');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const datePart = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        expect(wrapper.emitted('change')[0]).toEqual([datePart + 'T14:30:00.000']);
    });

    it('saves web time with seconds as canonical answers', async () => {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'time',
                answer: '',
                datetimeFormat: PARAMETERS.TIME_FORMAT_1
            }
        });
        const input = wrapper.find('input.datetime-web-input');
        input.element.value = '14:30:05';
        await input.trigger('change');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const datePart = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        expect(wrapper.emitted('change')[0]).toEqual([datePart + 'T14:30:05.000']);
    });

    it('emits clear when the web input is emptied', async () => {
        const wrapper = mount(DateTimeField, {
            props: {
                type: 'date',
                answer: '2026-10-09',
                datetimeFormat: PARAMETERS.DATE_FORMAT_1
            }
        });
        const input = wrapper.find('input.datetime-web-input');
        input.element.value = '';
        await input.trigger('change');
        expect(wrapper.emitted('clear')).toBeTruthy();
        expect(wrapper.emitted('change')).toBeFalsy();
    });
});
