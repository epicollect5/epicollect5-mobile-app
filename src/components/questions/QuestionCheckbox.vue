<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-possible-answers
					:questionText="state.question"
					:questionType="questionType"
					:possibleAnswers="state.inputDetails.possible_answers"
					:selectedAnswer="String()"
					:selectedAnswers="state.answer.answer"
					:isGroupInput="isGroupInput"
					@on-selected-answers="onSelectedAnswers"
				></question-label-possible-answers>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content class="question-checkbox-card-content">
			<div
				class="question-required half-padding"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<list-possible-answers-checkbox
				:possibleAnswers="state.inputDetails.possible_answers"
				:selectedAnswers="state.answer.answer"
				:isGroupInput="isGroupInput"
				@on-selected-answers="onSelectedAnswers"
				:hasError="hasError"
			>
			</list-possible-answers-checkbox>
			<div
				class="question-error half-padding-bottom"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>

		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject } from 'vue';
import QuestionLabelPossibleAnswers from '@/components/QuestionLabelPossibleAnswers';
import ListPossibleAnswersCheckbox from '@/components/ListPossibleAnswersCheckbox';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';
export default {
	components: {
		QuestionLabelPossibleAnswers,
		ListPossibleAnswersCheckbox
	},
	props: {
		inputRef: {
			type: String,
			required: true
		},
		type: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const { isGroupInput } = readonly(props);
		const questionType = readonly(props.type);
		const entriesAddState = inject('entriesAddState');
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			inputDetails: {},
			currentInputRef: null,
			error: {
				errors: []
			},
			required: false,
			question: '',
			pattern: null,
			answer: {
				answer: '',
				was_jumped: false
			},
			confirmAnswer: {
				verify: false,
				answer: ''
			}
		});

		const scope = { questionType, isGroupInput };

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
			console.log('isGroupInput -----------> ', isGroupInput);
		});

		const computedScope = {
			hasError: computed(() => {
				return utilsService.hasQuestionError(state);
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			})
		};

		const methods = {
			onSelectedAnswers(answerRefs) {
				console.log('onSelectedAnswers QuestionCheckbox called');
				state.answer.answer = answerRefs;
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...scope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>