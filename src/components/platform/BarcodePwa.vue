<template>
	<ion-grid
		class="ion-no-padding pwa-margin-fix"
	>
		<ion-row>
			<ion-col
				size-xs="12"
				offset-xs="0"
				size-sm="8"
				offset-sm="2"
				class="ion-align-self-center"
			>
				<div class="ion-margin-top">
					<input
						type="text"
						class="question-input ios-fix-border"
						:class="{ 'has-error': hasError }"
						:value="state.answer.answer"
						:placeholder="labels.type_answer_here"
						@input="onInputValueChange($event)"
					/>
					<div
						class="question-error"
						v-if="hasError"
					>
						{{ errorMessage }}
					</div>
				</div>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { computed } from '@vue/reactivity';
import { utilsService } from '@/services/utilities/utils-service';

export default {
	props: {
		parentState: {
			type: Object,
			required: true
		},
		isGroupInput: {
			type: Boolean
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = props.parentState;

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
			onInputValueChange(event) {
				const value = event.target.value;
				state.answer.answer = utilsService.getSanitisedAnswer(value);
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods
		};
	}
};
</script>
