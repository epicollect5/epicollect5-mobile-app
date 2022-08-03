<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
			<ion-card-subtitle
				v-if="hasPattern"
				class="ion-text-right ion-padding"
			>
				{{ labels.pattern }}:
				<span>
					&nbsp;{{state.pattern}}
				</span>
			</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content :class="{'ion-margin' : isGroupInput}">
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<input
				type="tel"
				inputmode="tel"
				class="question-input"
				:class="{'has-error' : hasError}"
				:placeholder="labels.type_answer_here"
				:value="state.answer.answer"
				@input="onInputValueChange($event)"
			/>
			<div
				class="question-error"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>
			<div v-if="state.confirmAnswer.verify">
				<hr>
				<input
					type="tel"
					inputmode="tel"
					class="question-input"
					:class="{'has-error' : hasError}"
					:placeholder="labels.confirm_answer_here"
					:value="state.confirmAnswer.answer"
					@input="onInputValueChangeConfirm($event)"
				/>
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
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject } from 'vue';

export default {
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
			type: Boolean,
			default: false
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const questionType = props.type.toUpperCase();
		const entriesAddState = inject('entriesAddState');
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

		const { isGroupInput } = readonly(props);

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const computedScope = {
			hasPattern: computed(() => {
				return state.pattern !== '' && state.pattern !== null;
			}),
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
		});

		const methods = {
			onInputValueChange(event) {
				const value = event.target.value;
				state.answer.answer = services.utilsService.getSanitisedAnswer(value);
			},
			onInputValueChangeConfirm(event) {
				const value = event.target.value;
				state.confirmAnswer.answer = services.utilsService.getSanitisedAnswer(value);
			}
		};

		return {
			labels: STRINGS[rootStore.language].labels,
			state,
			...props,
			...computedScope,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>