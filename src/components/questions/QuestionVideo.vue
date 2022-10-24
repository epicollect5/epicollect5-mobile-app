<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:disabled="!isFileAvailable"
					action="media"
					:questionText="state.question"
					:answer="state.answer.answer"
					@on-label-button-click="openPopover"
				></question-label-action>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{'ion-margin' : isGroupInput}"
		>
			<dropzone
				:filename="state.answer.answer"
				:key="state.answer.answer"
				v-if="isPWA"
				:type="state.inputDetails.type"
				:inputRef="state.inputDetails.ref"
				:uuid="entryUuid"
				@file-uploaded="onFileUploadedPWA"
			></dropzone>

			<grid-question-narrow v-if="!isPWA">
				<template #content>
					<ion-button
						class="question-action-button"
						color="secondary"
						expand="block"
						@click="shoot()"
					>
						<ion-icon
							slot="start"
							:icon="videocam"
						></ion-icon>
						{{labels.shoot}}
					</ion-button>
				</template>
			</grid-question-narrow>

			<!-- Video Preview -->
			<grid-question-narrow v-if="!isPWA">
				<template #content>
					<video
						v-show="state.fileSource !== ''"
						class="question-video-player"
						:src="state.fileSource"
						controls
					>
					</video>
				</template>
			</grid-question-narrow>

		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { Capacitor } from '@capacitor/core';
import { videoShoot } from '@/use/questions/video-shoot';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import Dropzone from '@/components/Dropzone';

export default {
	components: {
		GridQuestionNarrow,
		QuestionLabelAction,
		Dropzone
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
			pwaFileState: PARAMETERS.PWA_FILE_STATE.CACHED
		});

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		const tempDir = rootStore.tempDir;
		const persistentDir = rootStore.persistentDir;
		let filename = '';
		let source = '';

		const projectRef = entriesAddScope.entryService.entry.projectRef;
		const media = entriesAddScope.entryService.entry.media;
		// Check whether we want to index the media object using the main entry uuid, or branch entry uuid
		const entryUuid = !entriesAddState.isBranch
			? entriesAddScope.entryService.entry.entryUuid
			: entriesAddState.branchEntryService.entry.entryUuid;

		media[entryUuid] = media[entryUuid] || {};

		//get saved media details if any
		if (!Object.prototype.hasOwnProperty.call(media[entryUuid], state.inputDetails.ref)) {
			media[entryUuid][state.inputDetails.ref] = {};
			media[entryUuid][state.inputDetails.ref].cached = '';
			media[entryUuid][state.inputDetails.ref].stored = '';
			media[entryUuid][state.inputDetails.ref].type = state.inputDetails.type;

			if (rootStore.isPWA) {
				media[entryUuid][state.inputDetails.ref].filenamePWA = {};
				media[entryUuid][state.inputDetails.ref].filenamePWA.cached = '';
				media[entryUuid][state.inputDetails.ref].filenamePWA.stored = '';
			}
		} else {
			if (rootStore.isPWA) {
				//load preview in dropzone
				//show cached or stored image if any, Cached image will win over stored one
				if (media[entryUuid][state.inputDetails.ref].filenamePWA.cached !== '') {
					filename = media[entryUuid][state.inputDetails.ref].filenamePWA.cached;
					state.pwaFileState = PARAMETERS.PWA_FILE_STATE.CACHED;
				} else {
					if (media[entryUuid][state.inputDetails.ref].filenamePWA.stored !== '') {
						filename = media[entryUuid][state.inputDetails.ref].filenamePWA.stored;
						state.pwaFileState = PARAMETERS.PWA_FILE_STATE.STORED;
					}
				}
			} else {
				//show cached or stored image if any, Cached image will win over stored one
				if (media[entryUuid][state.inputDetails.ref].cached !== '') {
					filename = media[entryUuid][state.inputDetails.ref].cached;
					source = tempDir + filename;
					state.fileSource = Capacitor.convertFileSrc(source);
				} else {
					if (media[entryUuid][state.inputDetails.ref].stored !== '') {
						filename = media[entryUuid][state.inputDetails.ref].stored;
						source = persistentDir + PARAMETERS.VIDEO_DIR + projectRef + '/' + filename;
						state.fileSource = Capacitor.convertFileSrc(source);
					}
				}
			}
		}

		state.answer.answer = filename;

		const methods = {
			async openPopover(e) {
				const mediaFile = media[entryUuid][state.inputDetails.ref];
				if (rootStore.isPWA) {
					if (mediaFile.filenamePWA.cached === '' && mediaFile.filenamePWA.stored === '') {
						return false;
					}
				} else {
					if (mediaFile.cached === '' && mediaFile.stored === '') {
						return false;
					}
				}
				popoverMediaHandler({
					media,
					entryUuid,
					state,
					e,
					mediaType: PARAMETERS.QUESTION_TYPES.VIDEO
				});
			},
			shoot() {
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					videoShoot({ media, entryUuid, state, filename });
				}
			},
			onFileUploadedPWA(filename) {
				state.answer.answer = filename;
				media[entryUuid][state.inputDetails.ref].filenamePWA.cached = filename;
			}
		};

		const computedScope = {
			isFileAvailable: computed(() => {
				const mediaFile = media[entryUuid][state.inputDetails.ref];
				return mediaFile.cached !== '' || mediaFile.stored !== '' || mediaFile.filenamePWA !== '';
			}),
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		return {
			labels,
			state,
			entryUuid,
			...icons,
			...methods,
			...props,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
.question-location-grid {
	font-size: 18px;
	ion-row.border-bottom {
		border-bottom: 1px solid var(--ion-color-light-shade);
	}
}
</style>