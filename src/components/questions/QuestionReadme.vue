<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-content class="question-readme-content">
			<div
				v-html="html"
				:class="{'readme-padding' : isGroupInput}"
			>
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
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

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
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const computedScope = {
			html: computed(() => {
				return utilsService.htmlDecode(state.question);
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		const methods = {};

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