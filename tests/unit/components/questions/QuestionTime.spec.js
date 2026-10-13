import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import QuestionTime from '@/components/questions/QuestionTime.vue';
import { useRootStore } from '@/stores/root-store';
import { questionCommonService } from '@/services/entry/question-common-service';
import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';

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
						props: ['type', 'answer', 'datetimeFormat', 'min', 'max', 'locale', 'hasError']
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

	it('forwards the question error state to the shared field', () => {
		utilsService.hasQuestionError.mockReturnValueOnce(true);
		const wrapper = factory();
		expect(wrapper.findComponent({ name: 'DateTimeField' }).props('hasError')).toBe(true);
	});

	it('updates the answer on change', async () => {
		const wrapper = factory();
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('change', '1970-01-01T14:30:00.000');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('1970-01-01T14:30:00.000');
	});

	it('clears the answer on clear', async () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '1970-01-01T14:30:00.000';
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('clear');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('');
	});

	it('resets the input error on change', async () => {
		const wrapper = factory();
		wrapper.vm.state.currentInputRef = 'test_ref';
		wrapper.vm.state.error.errors = { test_ref: { message: 'required' } };
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('change', '1970-01-01T14:30:00.000');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.error.errors.test_ref.message).toBe('');
	});

	it('resets the input error on clear', async () => {
		const wrapper = factory();
		wrapper.vm.state.currentInputRef = 'test_ref';
		wrapper.vm.state.error.errors = { test_ref: { message: 'required' } };
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('clear');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.error.errors.test_ref.message).toBe('');
	});

	it('forwards a real boolean error state to the shared field', () => {
		//regression guard for the boolean-casting trap: the parent's hasError
		//must be a real boolean, never a message string. An empty string bound
		//to the field's Boolean has-error prop is cast to true by Vue, which
		//left the picker stuck in the red error style after the answer was set.
		utilsService.hasQuestionError.mockReturnValueOnce(true);
		const wrapper = factory();
		expect(wrapper.findComponent({ name: 'DateTimeField' }).props('hasError')).toBe(true);

		const clean = factory();
		expect(clean.findComponent({ name: 'DateTimeField' }).props('hasError')).toBe(false);
	});
});

describe('QuestionTime.vue - cached answers and defaults', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useRootStore().device = { platform: 'android' };
		//mimic the real setUpInputParams contract (input details + answer)
		questionCommonService.setUpInputParams.mockImplementation((state, inputRef, entriesAddState) => {
			state.inputDetails = entriesAddState.inputDetails;
			state.currentInputRef = inputRef;
			state.error = entriesAddState.error;
			state.required = !!entriesAddState.inputDetails.is_required;
			state.question = entriesAddState.inputDetails.question;
			state.answer = entriesAddState.answers[inputRef];
		});
	});

	afterEach(() => {
		questionCommonService.setUpInputParams.mockReset();
	});

	const factoryWithState = (inputDetails, answer) => {
		return mount(QuestionTime, {
			props: {
				inputRef: 'time_ref',
				type: 'time'
			},
			global: {
				provide: {
					entriesAddState: {
						inputDetails,
						answers: { time_ref: answer },
						error: { errors: [] }
					}
				},
				stubs: {
					...ION_STUBS,
					'date-time-field': {
						name: 'DateTimeField',
						template: '<div class="date-time-field-stub"></div>',
						props: ['type', 'answer', 'datetimeFormat', 'min', 'max', 'locale', 'hasError']
					}
				}
			}
		});
	};

	it.each([
		PARAMETERS.TIME_FORMAT_1,
		PARAMETERS.TIME_FORMAT_2,
		PARAMETERS.TIME_FORMAT_3,
		PARAMETERS.TIME_FORMAT_4,
		PARAMETERS.TIME_FORMAT_5
	])('renders the cached answer for format %s', (format) => {
		const wrapper = factoryWithState(
			{ datetime_format: format, question: 'Q?' },
			{ answer: '1970-01-01T14:30:05.000', was_jumped: false }
		);
		const field = wrapper.findComponent({ name: 'DateTimeField' });
		expect(field.props('type')).toBe('time');
		expect(field.props('answer')).toBe('1970-01-01T14:30:05.000');
		expect(field.props('datetimeFormat')).toBe(format);
	});

	it('defaults to the current time when requested', () => {
		//utils-service is mocked in this file: drive the wiring with
		//controlled values and assert the canonical answer is stored
		utilsService.getISOTime.mockReturnValueOnce('2026-10-09T08:15:30.000');
		const wrapper = factoryWithState(
			{ datetime_format: PARAMETERS.TIME_FORMAT_3, set_to_current_datetime: true, question: 'Q?' },
			{ answer: '', was_jumped: false }
		);
		expect(utilsService.getISOTime).toHaveBeenCalledWith(expect.any(Date), PARAMETERS.TIME_FORMAT_3);
		expect(wrapper.vm.state.answer.answer).toBe('2026-10-09T08:15:30.000');
	});

	it('leaves an empty answer alone without the default flag', () => {
		//clear first: the mock returns '' even when called, so without this
		//an accidental default-time call would still satisfy the assertion
		utilsService.getISOTime.mockClear();
		const wrapper = factoryWithState(
			{ datetime_format: PARAMETERS.TIME_FORMAT_3, question: 'Q?' },
			{ answer: '', was_jumped: false }
		);
		expect(utilsService.getISOTime).not.toHaveBeenCalled();
		expect(wrapper.vm.state.answer.answer).toBe('');
	});
});
