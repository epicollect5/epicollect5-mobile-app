import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import QuestionDecimal from '@/components/questions/QuestionDecimal.vue';

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

describe('QuestionDecimal.vue - increment/decrement', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	const factory = (props = {}) => {
		return mount(QuestionDecimal, {
			props: {
				inputRef: 'test_ref',
				type: 'decimal',
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

	it('plusDotOne adds inputStep to a non-empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '5.2';
		wrapper.vm.plusDotOne();
		expect(wrapper.vm.state.answer.answer).toBe('5.3');
	});

	it('plusDotOne defaults to 0.1 for an empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '';
		wrapper.vm.plusDotOne();
		expect(wrapper.vm.state.answer.answer).toBe(0.1);
	});

	it('minusDotOne subtracts inputStep from a non-empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '5.2';
		wrapper.vm.minusDotOne();
		expect(wrapper.vm.state.answer.answer).toBe('5.1');
	});

	it('minusDotOne defaults to -0.1 for an empty answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '';
		wrapper.vm.minusDotOne();
		expect(wrapper.vm.state.answer.answer).toBe(-0.1);
	});

	it('plusDotOne preserves precision of the existing answer', () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '5.25';
		wrapper.vm.plusDotOne();
		expect(wrapper.vm.state.answer.answer).toBe('5.26');
	});

	it('plusDotOneVerify adds inputStep to the confirmation answer', () => {
		const wrapper = factory();
		wrapper.vm.state.confirmAnswer.answer = '5.2';
		wrapper.vm.plusDotOneVerify();
		expect(wrapper.vm.state.confirmAnswer.answer).toBe('5.3');
	});

	it('minusDotOneVerify subtracts inputStep from the confirmation answer', () => {
		const wrapper = factory();
		wrapper.vm.state.confirmAnswer.answer = '5.2';
		wrapper.vm.minusDotOneVerify();
		expect(wrapper.vm.state.confirmAnswer.answer).toBe('5.1');
	});
});
