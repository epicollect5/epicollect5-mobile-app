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
					:isGroupInput="isGroupInput"
					:possibleAnswers="state.inputDetails.possible_answers"
					:selectedAnswers="state.selectedAnswers"
					@on-selected-answers="onSelectedAnswers"
				></question-label-possible-answers>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content class="force-no-padding">
			<div
				class="question-required half-padding"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<list-possible-answers-radio
				:possibleAnswers="state.inputDetails.possible_answers"
				:selectedAnswers="state.selectedAnswers"
				:isGroupInput="isGroupInput"
				:hasError="hasError"
				@on-selected-answers="onSelectedAnswers"
			>
			</list-possible-answers-radio>
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
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { reactive, computed, readonly, toRefs } from '@vue/reactivity';
import { inject, provide } from 'vue';
import QuestionLabelPossibleAnswers from '@/components/QuestionLabelPossibleAnswers';
import ListPossibleAnswersRadio from '@/components/ListPossibleAnswersRadio';

export default {
	components: {
		QuestionLabelPossibleAnswers,
		ListPossibleAnswersRadio
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
		const state = reactive({
			selectedAnswers: [],
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
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		//set up array with the selected answer to make modals and child componets work
		if (state.answer.answer !== '') {
			state.selectedAnswers = [state.answer.answer];
		}

		const computedScope = {
			hasError: computed(() => {
				//any error for this question?
				return services.utilsService.questionHasError(readonly(state));
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
			console.log('isGroupInput -----------> ', isGroupInput);
		});

		const methods = {
			onSelectedAnswers(answers) {
				//imp: we keep the selected answers array because if we convert it to string,
				//imp: and back to array, it becomes an empty string
				//imp: and we are not able to pass it to the modal possible answers
				//imp: for some reason, state.answer.answer is passed as an empty string
				//imp: therefore we pass it as array (without converting it) and all works....
				//imp: maybe the conversion breaks the reactivity
				if (answers.length > 0) {
					state.answer.answer = answers[0];
					state.selectedAnswers = answers;
				} else {
					state.answer.answer = '';
					state.selectedAnswers = [];
				}
			}
		};

		return {
			labels: STRINGS[rootStore.language].labels,
			state,
			...icons,
			...computedScope,
			...scope,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>