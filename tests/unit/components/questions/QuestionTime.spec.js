import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import QuestionTime from '@/components/questions/QuestionTime.vue';
import {useRootStore} from '@/stores/root-store';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn()
	};
	return {questionCommonService};
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
	return {utilsService};
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
		//android with a format without seconds renders the HTML input chip
		useRootStore().device = {platform: 'android'};
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
				stubs: ION_STUBS
			}
		});
	};

	it('keeps the native input[type="time"]', () => {
		const wrapper = factory();
		expect(wrapper.find('input[type="time"]').exists()).toBe(true);
	});

	it('marks the input as is-empty when there is no answer', () => {
		const wrapper = factory();
		expect(wrapper.find('input[type="time"]').classes()).toContain('is-empty');
	});

	it('removes is-empty once an answer is set', async () => {
		const wrapper = factory();
		wrapper.vm.state.time.answer = '14:30';
		await wrapper.vm.$nextTick();
		expect(wrapper.find('input[type="time"]').classes()).not.toContain('is-empty');
	});
});
