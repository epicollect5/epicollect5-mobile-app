<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
			<ion-card-subtitle class="ion-text-right">
				{{labels.format}}:&nbsp;{{state.inputDetails.datetime_format}}</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content
			:class="{'ion-margin' : isGroupInput}"
			class="ion-text-center"
		>
			<div
				class="question-required"
				:class="{'ion-padding-start' : isGroupInput}"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<grid-question-narrow wide>
				<template #content>
					<date-time-field
						type="date"
						:key="hasError ? 'date-error' : 'date-ok'"
						:answer="state.answer.answer"
						:datetime-format="state.inputDetails.datetime_format"
						:has-error="hasError"
						@change="onDateChange"
						@clear="clearDate"
					></date-time-field>
				</template>
			</grid-question-narrow>

			<div
				class="question-error"
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
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';
import DateTimeField from '@/components/DateTimeField.vue';
import GridQuestionNarrow from '@/components/GridQuestionNarrow.vue';

export default {
	components: {
		DateTimeField,
		GridQuestionNarrow
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
			type: Boolean,
			default: false
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
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
			}
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		let today = '';

		// Set to default datetime if requested
		if (state.inputDetails.set_to_current_datetime && state.answer.answer === '') {
			//Important: we need to hack it a bit to get the absolute date, without timezone offset
			today = new Date();
			state.answer.answer = utilsService.getISODateOnly(
				utilsService.toISOStringLocale(today),
				state.inputDetails.datetime_format
			); //no timezone!
		}

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

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		const methods = {
			resetInputError() {
				//a failed submit pins the error until the next validation:
				//answering must lift it at once, otherwise the red border
				//and message survive picking a valid date. A still-invalid
				//answer is re-flagged on the next submit.
				const inputError = state.error.errors[state.currentInputRef];
				if (inputError) {
					inputError.message = '';
				}
			},
			onDateChange(canonical) {
				state.answer.answer = canonical;
				state.answer.was_jumped = false;
				methods.resetInputError();
			},
			clearDate() {
				console.log('clear clicked');

				state.answer.answer = '';
				state.answer.was_jumped = false;
				methods.resetInputError();
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style src="@/theme/components/questions/QuestionDate.scss" lang="scss"></style>
