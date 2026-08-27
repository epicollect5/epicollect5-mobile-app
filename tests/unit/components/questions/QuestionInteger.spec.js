import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import QuestionInteger from '@/components/questions/QuestionInteger.vue';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn()
	};
	return {questionCommonService};
});

const ION_STUBS = {
	'ion-card': true,
	'ion-card-header': true,
	'ion-card-title': true,
	'ion-card-subtitle': true,
	'ion-card-content': true,
	'ion-chip': true,
	'ion-icon': true,
	'ion-label': true
};

describe('QuestionInteger.vue - increment/decrement', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	const factory = (props = {}) => {
		return mount(QuestionInteger, {
			props: {
				inputRef: 'test_ref',
				type: 'integer',
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

	it('plusOne adds 1 to a non-empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '5';
		wrapper.vm.plusOne();
		expect(wrapper.vm.state.answer.answer).toBe(6);
	});

	it('plusOne defaults to 1 for an empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '';
		wrapper.vm.plusOne();
		expect(wrapper.vm.state.answer.answer).toBe(1);
	});

	it('minusOne subtracts 1 from a non-empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '5';
		wrapper.vm.minusOne();
		expect(wrapper.vm.state.answer.answer).toBe(4);
	});

	it('minusOne defaults to -1 for an empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '';
		wrapper.vm.minusOne();
		expect(wrapper.vm.state.answer.answer).toBe(-1);
	});

	it('plusOneVerify adds 1 to the confirmation answer', () => {
		const wrapper = factory();
		wrapper.vm.state.confirmAnswer.answer = '5';
		wrapper.vm.plusOneVerify();
		expect(wrapper.vm.state.confirmAnswer.answer).toBe(6);
	});

	it('minusOneVerify subtracts 1 from the confirmation answer', () => {
		const wrapper = factory();
		wrapper.vm.state.confirmAnswer.answer = '5';
		wrapper.vm.minusOneVerify();
		expect(wrapper.vm.state.confirmAnswer.answer).toBe(4);
	});
});
