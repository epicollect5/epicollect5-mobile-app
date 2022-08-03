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
				<div v-if="hasPattern">
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
				mode="ios"
				outline
				color="dark"
				class="chip-numeric"
				lang="en-US"
			>
				<ion-icon
					size="large"
					class="chip-numeric--icon-left"
					:icon="removeSharp"
					@click="minusDotOne()"
				></ion-icon>
				<ion-label>
					<input
						v-if="isIOS"
						type="text"
						class="question-input question-numeric ion-text-center"
						:class="{'has-error' : hasError}"
						v-model="state.answer.answer"
					/>
					<input
						v-else
						type="number"
						inputmode="decimal"
						:step="state.inputStep"
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
					@click="plusDotOne()"
				></ion-icon>
			</ion-chip>

			<div
				class="question-error"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>
			<ion-chip
				v-if="state.confirmAnswer.verify"
				mode="ios"
				outline
				color="dark"
				class="chip-numeric"
			>
				<ion-icon
					size="large"
					class="chip-numeric--icon-left"
					:icon="removeSharp"
					@click="minusDotOneVerify()"
				></ion-icon>
				<ion-label>
					<input
						v-if="isIOS"
						type="text"
						class="question-input question-numeric ion-text-center"
						:class="{'has-error' : hasError}"
						v-model="state.confirmAnswer.answer"
					/>
					<input
						v-else
						type="number"
						inputmode="decimal"
						lang="en-US"
						:step="state.inputStep"
						class="question-input question-numeric ion-text-center"
						:class="{'has-error' : hasError}"
						v-model.number="state.confirmAnswer.answer"
					/>
				</ion-label>
				<ion-icon
					size="large"
					class="chip-numeric--icon-right"
					:icon="addSharp"
					@click="plusDotOneVerify()"
				></ion-icon>
			</ion-chip>
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
import { PARAMETERS } from '@/config';

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
		const questionType = props.type.toUpperCase();
		const entriesAddState = inject('entriesAddState');
		const rootStore = useRootStore();
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
			},
			inputStep: 0.1
		});

		let fixedDigits = 0;

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		// Parse answer into decimal, keep all digits after .
		if (state.answer.answer !== '') {
			if (state.answer.answer.toString().indexOf('.') > -1) {
				fixedDigits = state.answer.answer.toString().split('.')[1].length;
			}
			state.answer.answer = parseFloat(state.answer.answer, 10).toFixed(fixedDigits);
		}

		// Parse confirmation answer into decimal, keep all digits after .
		if (state.confirmAnswer.answer !== '') {
			if (state.confirmAnswer.answer.toString().indexOf('.') > -1) {
				fixedDigits = state.confirmAnswer.answer.toString().split('.')[1].length;
			}
			state.confirmAnswer.answer = parseFloat(state.confirmAnswer.answer, 10).toFixed(fixedDigits);
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
			plusDotOne() {
				let fixedDigits = 1;
				state.answer.answer = state.answer.answer.toString();

				if (state.answer.answer.includes('.')) {
					fixedDigits = state.answer.answer.split('.')[1].length;
				}
				state.inputStep = services.utilsService.getStepPrecision(fixedDigits);

				/* eslint-disable no-mixed-spaces-and-tabs */
				state.answer.answer =
					state.answer.answer === ''
						? 0.1
						: (parseFloat(state.answer.answer, 10) + state.inputStep).toFixed(fixedDigits);
				/* eslint-enable no-mixed-spaces-and-tabs */
			},
			minusDotOne() {
				let fixedDigits = 1;
				state.answer.answer = state.answer.answer.toString();

				if (state.answer.answer.includes('.')) {
					fixedDigits = state.answer.answer.split('.')[1].length;
				}

				state.inputStep = services.utilsService.getStepPrecision(fixedDigits);

				/* eslint-disable no-mixed-spaces-and-tabs */
				state.answer.answer =
					state.answer.answer === ''
						? -0.1
						: (parseFloat(state.answer.answer, 10) - state.inputStep).toFixed(fixedDigits);
				/* eslint-enable no-mixed-spaces-and-tabs */
			},
			plusDotOneVerify() {
				let fixedDigits = 1;
				state.confirmAnswer.answer = state.confirmAnswer.answer.toString();

				if (state.confirmAnswer.answer.includes('.')) {
					fixedDigits = state.confirmAnswer.answer.split('.')[1].length;
				}

				state.inputStep = services.utilsService.getStepPrecision(fixedDigits);

				state.confirmAnswer.answer =
					state.confirmAnswer.answer === ''
						? 0.1
						: (parseFloat(state.confirmAnswer.answer, 10) + state.inputStep).toFixed(fixedDigits);
			},
			minusDotOneVerify() {
				let fixedDigits = 1;
				state.confirmAnswer.answer = state.confirmAnswer.answer.toString();

				if (state.confirmAnswer.answer.includes('.')) {
					fixedDigits = state.confirmAnswer.answer.split('.')[1].length;
				}

				state.inputStep = services.utilsService.getStepPrecision(fixedDigits);

				state.confirmAnswer.answer =
					state.confirmAnswer.answer === ''
						? -0.1
						: (parseFloat(state.confirmAnswer.answer, 10) - state.inputStep).toFixed(fixedDigits);
			},
			filterAnswerInvalidChars() {
				//todo:????? do we need this?
			},
			isIOS: computed(() => {
				return rootStore.device.platform === PARAMETERS.IOS;
			})
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