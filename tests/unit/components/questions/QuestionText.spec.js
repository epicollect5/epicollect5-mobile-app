import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import flushPromises from 'flush-promises';
import QuestionText from '@/components/questions/QuestionText.vue';
import {modalController} from '@ionic/vue';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn((state) => {
			state.inputDetails = {ref: 'test_ref'};
			state.currentInputRef = 'test_ref';
			state.error = {errors: {}};
		})
	};
	return {questionCommonService};
});

vi.mock('@/services/notification-service', () => ({
	notificationService: {
		showProgressDialog: vi.fn(() => Promise.resolve()),
		hideProgressDialog: vi.fn()
	}
}));

vi.mock('@ionic/vue', () => ({
	modalController: {
		create: vi.fn(),
		dismiss: vi.fn(() => Promise.resolve())
	}
}));

const factory = (props = {}) => {
	return mount(QuestionText, {
		props: {
			inputRef: 'test_ref',
			type: 'text',
			...props
		},
		global: {
			provide: {
				entriesAddState: {questionParams: {isBranch: false}}
			}
		}
	});
};

const mockModalDismiss = () => {
	let resolveDismiss;
	modalController.create.mockResolvedValueOnce({
		present: vi.fn(() => Promise.resolve()),
		onWillDismiss: vi.fn(() => new Promise((resolve) => {
			resolveDismiss = resolve;
		}))
	});
	return (response) => {
		resolveDismiss(response);
	};
};

describe('QuestionText.vue - hardened input handling', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('sanitises a normal string answer', () => {
		const wrapper = factory();
		wrapper.vm.onInputValueChange({target: {value: '  <a>  '}});
		expect(wrapper.vm.state.answer.answer).toBe('\ufe64a\ufe65');
	});

	it('does not throw on undefined/null/detached input events', () => {
		const wrapper = factory();
		expect(() => {
			wrapper.vm.onInputValueChange({target: {value: undefined}});
		}).not.toThrow();
		expect(wrapper.vm.state.answer.answer).toBe('');
		expect(() => {
			wrapper.vm.onInputValueChange({target: {value: null}});
		}).not.toThrow();
		expect(wrapper.vm.state.answer.answer).toBe('');
		expect(() => {
			wrapper.vm.onInputValueChange({});
		}).not.toThrow();
		expect(wrapper.vm.state.answer.answer).toBe('');
	});

	it('does not throw on undefined confirm input events', () => {
		const wrapper = factory();
		expect(() => {
			wrapper.vm.onInputValueChangeConfirm({target: {value: undefined}});
		}).not.toThrow();
		expect(wrapper.vm.state.confirmAnswer.answer).toBe('');
	});

	it.each([undefined, null, ''])('ignores %p modal dismissal instead of poisoning the answer', async (data) => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = 'original';
		const dismiss = mockModalDismiss();
		await wrapper.vm.openModalSavedAnswer();
		dismiss({data});
		await flushPromises();
		expect(wrapper.vm.state.answer.answer).toBe('original');
	});

	it('ignores a missing dismiss response entirely', async () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = 'original';
		const dismiss = mockModalDismiss();
		await wrapper.vm.openModalSavedAnswer();
		dismiss(undefined);
		await flushPromises();
		expect(wrapper.vm.state.answer.answer).toBe('original');
	});

	it('assigns a real saved answer from the modal', async () => {
		const wrapper = factory();
		const dismiss = mockModalDismiss();
		await wrapper.vm.openModalSavedAnswer();
		dismiss({data: 'saved answer'});
		await flushPromises();
		expect(wrapper.vm.state.answer.answer).toBe('saved answer');
	});
});
