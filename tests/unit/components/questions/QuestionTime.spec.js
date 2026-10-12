import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import QuestionTime from '@/components/questions/QuestionTime.vue';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn()
	};
	return { questionCommonService };
});

vi.mock('@/services/utilities/utils-service', () => {
	const utilsService = {
		getUserFormattedTime: vi.fn(() => ''),
		getInputFormattedTime: vi.fn(() => ''),
		getPickerFormattedTime: vi.fn(() => ''),
		getISOTime: vi.fn(() => ''),
		toISOStringLocale: vi.fn(() => ''),
		hasQuestionError: vi.fn(() => false)
	};
	return { utilsService };
});

const ION_STUBS = {
	'ion-card': true,
	'ion-card-header': true,
	'ion-card-title': true,
	'ion-card-subtitle': true,
	'ion-card-content': true,
	'ion-chip': true,
	'ion-icon': true,
	'ion-label': true,
	'ion-grid': true,
	'ion-row': true,
	'ion-col': true
};

describe('QuestionTime.vue - native time field', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		//android with a format without seconds renders the shared field
		useRootStore().device = { platform: 'android' };
	});

	const factory = (props = {}) => {
		return mount(QuestionTime, {
			props: {
				inputRef: 'test_ref',
				type: 'time',
				...props
			},
			provide: {
				entriesAddState: {}
			},
			global: {
				stubs: {
					...ION_STUBS,
					'date-time-field': {
						name: 'DateTimeField',
						template: '<div class="date-time-field-stub"></div>',
						props: ['type', 'answer', 'datetimeFormat', 'min', 'max', 'locale']
					}
				}
			}
		});
	};

	it('renders the shared date-time-field', () => {
		const wrapper = factory();
		expect(wrapper.findComponent({ name: 'DateTimeField' }).exists()).toBe(true);
	});

	it('passes answer and datetime-format to the shared field', () => {
		const wrapper = factory();
		const field = wrapper.findComponent({ name: 'DateTimeField' });
		expect(field.exists()).toBe(true);
		expect(field.props('type')).toBe('time');
	});

	it('updates the answer on change', async () => {
		const wrapper = factory();
		wrapper.vm.onTimeChange('1970-01-01T14:30:00.000');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('1970-01-01T14:30:00.000');
	});

	it('clears the answer on clear', async () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '1970-01-01T14:30:00.000';
		wrapper.vm.clearTime();
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('');
	});
});
