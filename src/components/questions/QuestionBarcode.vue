<template>
	<ion-card
		class="question-card"
		:class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{ state.question }}
			</ion-card-title>
			<ion-card-subtitle
				v-if="hasPattern"
				class="question-properties"
			>
				{{ labels.pattern }}:&nbsp;{{ state.pattern }}
			</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{ 'ion-margin': isGroupInput }"
		>
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<div
				class="question-error"
				v-if="hasError"
			>
				{{ errorMessage }}
			</div>
			<barcode-pwa
				v-if="isPWA"
				:parentState="state"
				:isGroupInput="isGroupInput"
			></barcode-pwa>

			<barcode-native
				v-else
				:parentState="state"
				:isGroupInput="isGroupInput"
			></barcode-native>
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
import BarcodePwa from '@/components/platform/BarcodePwa';
import BarcodeNative from '@/components/platform/BarcodeNative';

export default {
	components: {
		BarcodePwa,
		BarcodeNative
	},
	props: {
		inputRef: {
			type: String,
			required: true
		},
		type: {
			required: true
		},
		isGroupInput: {
			type: Boolean
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
			confirmAnswer: {
				verify: false,
				answer: ''
			},
			fileSource: '',
			isScanningBarcode: false
		});

		//set up question
		questionCommonService.setUpInputParams(
			state,
			props.inputRef,
			entriesAddState
		);

		const computedScope = {
			hasPattern: computed(() => {
				return state.pattern !== '' && state.pattern !== null;
			}),
			hasError: computed(() => {
				return utilsService.hasQuestionError(state);
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			}),
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		onMounted(() => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		return {
			labels,
			state,
			...computedScope
		};
	}
};
</script>

<style src="@/theme/components/questions/QuestionBarcode.scss" lang="scss"></style>
