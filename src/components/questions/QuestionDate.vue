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
			<ion-grid class="ion-no-padding">
				<ion-row>
					<ion-col
						size-xs="12"
						offset-xs="0"
						size-sm="10"
						offset-sm="1"
						size-md="8"
						offset-md="2"
						size-lg="6"
						offset-lg="3"
						class="ion-align-self-center"
					>

						<ion-chip
							class="chip-datetimepicker"
							:class="{'has-error' : hasError, 'web-picker': isWEB}"
							outline
							mode="ios"
						>

							<div class="datetime-value">
								<ion-icon
									v-if="!isWEB"
									class="date-icon-left"
									size="small"
									:icon="calendarClearOutline"
								></ion-icon>
								<input
									type="date"
									class="question-input question-datetimepicker"
									v-model.trim="state.date.answer"
									@change="getDate()"
								/>
							</div>
							<ion-icon
								size="large"
								:icon="closeOutline"
								@click="clearDate()"
							></ion-icon>
						</ion-chip>
					</ion-col>
				</ion-row>
			</ion-grid>

			<div>
				<div>{{labels.date_selected_is}}
					<strong>{{state.userFormattedDate === '' ? ' --- ' : state.userFormattedDate}}</strong>
				</div>
			</div>
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
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { reactive, computed } from '@vue/reactivity';
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
			},
			date: {
				answer: ''
			},
			userFormattedDate: null,
			inputFormattedDate: null
		});

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		let today = '';

		// Display cached answer formatted based on what the user selected on the formbuilder
		if (state.answer.answer === '') {
			state.userFormattedDate = '';
		} else {
			state.userFormattedDate = services.utilsService.getUserFormattedDate(
				state.answer.answer,
				state.inputDetails.datetime_format
			);
			state.inputFormattedDate = services.utilsService.getInputFormattedDate(state.answer.answer);

			//imp: check this by setting a different timezone
			//IMPORTANT Add timezone in, so the local date is still correct in the date picker
			//console.log(state.answer.answer + services.utilsService.getTimeZone());

			//see this answer for Safari issues https://goo.gl/guXxh7
			//debugger;
			//state.date.answer = state.answer.answer + services.utilsService.getTimeZone();
			//imp: timezone not needed for a input type date, YYYY-MM-DD, ??
			state.date.answer = state.answer.answer.substring(0, 10);
		}

		// Set to default datetime if requested
		if (state.inputDetails.set_to_current_datetime && state.answer.answer === '') {
			//Important: we need to hack it a bit to get the absolute date, without timezone offset
			today = new Date();
			state.inputFormattedDate = services.utilsService.getInputFormattedDate(today.toISOString());
			state.answer.answer = services.utilsService.getISODateOnly(
				today.toISOString(),
				state.inputDetails.datetime_format
			); //no timezone!
			//show today's date in input type "date" on first run
			state.date.answer = state.inputFormattedDate;
			state.userFormattedDate = services.utilsService.getUserFormattedDate(
				today.toISOString(),
				state.inputDetails.datetime_format
			);
		}

		const computedScope = {
			hasError: computed(() => {
				return services.utilsService.hasQuestionError(state);
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			}),
			isWEB: computed(() => {
				return rootStore.device.platform === PARAMETERS.WEB;
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		const methods = {
			showDatePicker() {
				//imp:this does not work
				const element = document.querySelector('.question-datetimepicker');
				element.addEventListener('click', () => {
					console.log('focus on datepicker');
				});
				const event = new Event('click');
				element.dispatchEvent(event);
				//look at https://caniuse.com/mdn-api_htmlinputelement_showpicker
				//---------------------------------------------------------------
				//we just bypass any click on the calendar icon with pointer-events:none
			},
			clearDate() {
				console.log('clear clicked');

				state.answer.answer = '';
				state.answer.was_jumped = false;

				state.date.answer = null;
				state.userFormattedDate = null;
				state.inputFormattedDate = null;
			},
			getDate() {
				//state.date.answer is '' when users use the "cancel" button of the datepicker
				if (state.date.answer === '') {
					state.answer.answer = '';
					state.answer.was_jumped = false;
					state.inputFormattedDate = null;
					state.userFormattedDate = '---';
				} else {
					// Set model
					state.answer.answer = services.utilsService.getISODateOnly(
						state.date.answer,
						state.inputDetails.datetime_format
					); //no timezone!
					state.inputFormattedDate = services.utilsService.getInputFormattedDate(
						state.answer.answer
					);
					// Show formatted date
					state.userFormattedDate = services.utilsService.getUserFormattedDate(
						state.date.answer,
						state.inputDetails.datetime_format
					);
				}
			}
		};

		return {
			labels,
			state,
			...icons,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>