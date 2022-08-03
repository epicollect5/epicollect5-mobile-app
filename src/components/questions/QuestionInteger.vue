<template>
	<ion-card
		class="question-card question-numeric"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
			<ion-card-subtitle
				class="question-properties ion-text-right"
				v-if="hasPattern || hasMin || hasMax"
			>
				<div
					v-if="hasPattern"
					class="ion-text-right ion-padding"
				>
					{{ labels.pattern }}:
					<span>&nbsp;{{state.pattern}}</span>
				</div>
				<span v-if="hasMin">
					{{labels.min}}:&nbsp;
					<span>{{state.inputDetails.min}}&nbsp;&nbsp;</span>
				</span>
				<span v-if="hasMax">
					{{labels.max}}:&nbsp;
					<span>{{state.inputDetails.max}}&nbsp;&nbsp;</span>
				</span>
			</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content
			:class="{'ion-margin' : isGroupInput}"
			class="ion-text-center"
		>
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>

			<ion-chip
				class="chip-numeric"
				mode="ios"
				outline
				color="dark"
			>
				<ion-icon
					size="large"
					class="chip-numeric--icon-left"
					:icon="removeSharp"
					@click="minusOne()"
				></ion-icon>
				<ion-label>
					<input
						type="number"
						inputmode="numeric"
						lang="en-US"
						class="question-input question-numeric ion-text-center"
						:class="{'has-error' : hasError}"
						v-model.number="state.answer.answer"
					/>
				</ion-label>
				<ion-icon
					size="large"
					class="chip-numeric--icon-right"
					:icon="addSharp"
					@click="plusOne()"
				></ion-icon>
			</ion-chip>

			<div
				class="question-error"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>
			<div v-if="state.confirmAnswer.verify">

				<ion-chip
					class="chip-numeric"
					mode="ios"
					outline
					color="dark"
				>
					<ion-icon
						size="large"
						class="chip-numeric--icon-left"
						:icon="removeSharp"
						@click="minusOneVerify()"
					></ion-icon>
					<ion-label>
						<input
							type="number"
							inputmode="numeric"
							lang="en-US"
							class="question-input question-numeric ion-text-center"
							:class="{'has-error' : hasError}"
							v-model.number="state.confirmAnswer.answer"
						/>
					</ion-label>
					<ion-icon
						size="large"
						class="chip-numeric--icon-right"
						:icon="addSharp"
						@click="plusOneVerify()"
					></ion-icon>

				</ion-chip>
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

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		// Parse answer into integer
		if (state.answer.answer !== '') {
			state.answer.answer = parseInt(state.answer.answer, 10);
		}
		if (state.confirmAnswer.answer !== '') {
			state.confirmAnswer.answer = parseInt(state.confirmAnswer.answer, 10);
		}

		const computedScope = {
			hasPattern: computed(() => {
				return state.pattern !== '' && state.pattern !== null;
			}),
			hasMin: computed(() => {
				return state.inputDetails.min !== '';
			}),
			hasMax: computed(() => {
				return state.inputDetails.max !== '';
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
			plusOne() {
				state.answer.answer = state.answer.answer === '' ? 1 : Number(state.answer.answer) + 1;
			},
			minusOne() {
				state.answer.answer = state.answer.answer === '' ? -1 : Number(state.answer.answer) - 1;
			},
			plusOneVerify() {
				state.confirmAnswer.answer =
					state.confirmAnswer.answer === '' ? 1 : Number(state.confirmAnswer.answer) + 1;
			},
			minusOneVerify() {
				state.confirmAnswer.answer =
					state.confirmAnswer.answer === '' ? -1 : Number(state.confirmAnswer.answer) - 1;
			},
			filterAnswerInvalidChars() {
				//todo:????? do we need this?
			}
		};

		return {
			labels: STRINGS[rootStore.language].labels,
			state,
			...icons,
			...computedScope,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>