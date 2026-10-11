import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import QuestionDate from '@/components/questions/QuestionDate.vue';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn()
	};
	return {questionCommonService};
});

vi.mock('@/services/utilities/utils-service', () => {
	const utilsService = {
		getUserFormattedDate: vi.fn(() => ''),
		getInputFormattedDate: vi.fn(() => ''),
		getISODateOnly: vi.fn(() => ''),
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

describe('QuestionDate.vue - native date field', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	const factory = (props = {}) => {
		return mount(QuestionDate, {
			props: {
				inputRef: 'test_ref',
				type: 'date',
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

	it('keeps the native input[type="date"]', () => {
		const wrapper = factory();
		expect(wrapper.find('input[type="date"]').exists()).toBe(true);
	});

	it('marks the input as is-empty when there is no answer', () => {
		const wrapper = factory();
		expect(wrapper.find('input[type="date"]').classes()).toContain('is-empty');
	});

	it('removes is-empty once an answer is set', async () => {
		const wrapper = factory();
		wrapper.vm.state.date.answer = '2026-10-09';
		await wrapper.vm.$nextTick();
		expect(wrapper.find('input[type="date"]').classes()).not.toContain('is-empty');
	});
});
