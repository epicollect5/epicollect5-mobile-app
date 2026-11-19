<template>
	<media-pwa
		v-if="isPWA"
		:parentState="state"
		:entryUuid="entryUuid"
		:isGroupInput="isGroupInput"
	></media-pwa>

	<video-native
		v-else
		:parentState="state"
		:entryUuid="entryUuid"
		:isGroupInput="isGroupInput"
	></video-native>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import MediaPwa from '@/components/platform/MediaPwa';
import VideoNative from '@/components/platform/VideoNative';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		MediaPwa,
		VideoNative
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
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const questionType = props.type.toUpperCase();
		const entriesAddState = inject('entriesAddState');
		const entriesAddScope = rootStore.entriesAddScope;
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
			pwaFileState: PARAMETERS.PWA_FILE_STATE.CACHED,
			fileError: labels.unknown_error
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const computedScope = {
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		onMounted(() => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		// Check whether we want to index the media object using the main entry uuid, or branch entry uuid
		const entryUuid = !entriesAddState.questionParams.isBranch
			? entriesAddScope.entryService.entry.entryUuid //use entry_uuid
			: entriesAddScope.branchEntryService.entry.
				entryUuid;//use branch entry_uuid

		const media = entriesAddScope.entryService.entry.media;

		//ensure the media slot for this input exists; the PWA file fields are
		//added by MediaPwa, native only needs the base slot
		media[entryUuid] = media[entryUuid] || {};
		if (!Object.prototype.hasOwnProperty.call(media[entryUuid], state.inputDetails.ref)) {
			media[entryUuid][state.inputDetails.ref] = {};
			media[entryUuid][state.inputDetails.ref].cached = '';
			media[entryUuid][state.inputDetails.ref].stored = '';
			media[entryUuid][state.inputDetails.ref].type = state.inputDetails.type;
		}

		return {
			state,
			entryUuid,
			...computedScope
		};
	}
};
</script>
