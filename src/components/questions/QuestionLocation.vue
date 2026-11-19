<template>
	<location-pwa
		v-if="isPWA"
		:inputRef="inputRef"
		:parentState="state"
		:isGroupInput="isGroupInput"
	></location-pwa>

	<location-native
		v-else
		:parentState="state"
		:isGroupInput="isGroupInput"
	></location-native>
</template>

<script>
import { onMounted } from 'vue';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { useRootStore } from '@/stores/root-store';
import LocationPwa from '@/components/platform/LocationPwa';
import LocationNative from '@/components/platform/LocationNative';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		LocationPwa,
		LocationNative
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
			required: true
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
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		return {
			state,
			...computedScope,
			...props
		};
	}
};
</script>
