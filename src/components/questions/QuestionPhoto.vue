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
				:filestate="state.pwaFileState"
				:filename="state.answer.answer"
				:key="state.answer.answer"
				v-if="isPWA"
				:type="state.inputDetails.type"
				:inputRef="state.inputDetails.ref"
				:uuid="entryUuid"
				:fileError="state.fileError"
				@file-loaded="onFileLoadedPWA"
				@file-dropped="onFileDroppedPWA"
				@file-error="onFileErrorPWA"
			></dropzone>

			<grid-question-narrow v-if="!isPWA">
				<template #content>
					<ion-button
						class="question-action-button"
						color="secondary"
						expand="block"
						@click="takePicture('camera')"
					>
						<ion-icon
							slot="start"
							:icon="camera"
						></ion-icon>
						{{labels.take}}
					</ion-button>
				</template>
			</grid-question-narrow>

			<grid-question-narrow v-if="!isPWA">
				<template #content>
					<ion-button
						class="question-action-button"
						color="secondary"
						expand="block"
						@click="takePicture('gallery')"
					>
						<ion-icon
							slot="start"
							:icon="images"
						></ion-icon>
						{{labels.pick}}
					</ion-button>
				</template>
			</grid-question-narrow>

			<!-- Photo thumbail -->
			<div
				v-if="state.imageSource !== ''"
				class="question-photo-thumbnail animate__animated animate__fadeIn ion-margin-top"
			>
				<img
					:src="state.imageSource"
					@click="openViewer()"
					@load="onImageLoad()"
				/>
			</div>

		</ion-card-content>
	</ion-card>
</template>

<script>
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import { onMounted } from 'vue';
import { modalController } from '@ionic/vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { camera, images } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { Capacitor } from '@capacitor/core';
import ModalPhoto from '@/components/modals/ModalPhoto';
import { photoTake } from '@/use/questions/photo-take';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import Dropzone from '@/components/Dropzone';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

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
			imageSource: '',
			fileSource: '',
			pwaFileState: PARAMETERS.PWA_FILE_STATE.CACHED,
			fileError: labels.unknow_error
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		const tempDir = rootStore.tempDir;
		const persistentDir = rootStore.persistentDir;
		let filename = '';

		const project_ref = entriesAddScope.entryService.entry.projectRef;
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
					_loadImageOnView(tempDir + filename);
				} else {
					if (media[entryUuid][state.inputDetails.ref].stored !== '') {
						filename = media[entryUuid][state.inputDetails.ref].stored;
						_loadImageOnView(persistentDir + PARAMETERS.PHOTO_DIR + project_ref + '/' + filename);
					}
				}
			}
		}

		state.answer.answer = filename;

		function _loadImageOnView(source) {
			const timestamp = utilsService.generateTimestamp();
			state.fileSource = source;
			//fix for WKWebView and Android 11+ as well
			source = Capacitor.convertFileSrc(source);
			//use a timestamp to refresh image
			state.imageSource = source + '?t=' + timestamp;
		}

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
					mediaType: PARAMETERS.QUESTION_TYPES.PHOTO
				});
			},
			takePicture(action) {
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					photoTake({ media, entryUuid, state, filename, action });
				}
			},
			//open viewer to see image with zoom capabilities
			async openViewer() {
				const modal = await modalController.create({
					component: ModalPhoto,
					componentProps: {
						imageSource: state.imageSource,
						fileSource: state.fileSource
					}
				});
				return modal.present();
			},
			onImageLoad() {
				notificationService.hideProgressDialog();
			},
			onImageError(error) {
				console.log(error);
				console.log('Image failed!');
				notificationService.hideProgressDialog();
			},
			onFileLoadedPWA(filename) {
				state.answer.answer = filename;
			},
			onFileDroppedPWA(filename) {
				//if a file is dropped, we have a cached file to show
				//(cached takes priority on stored, if any)
				media[entryUuid][state.inputDetails.ref].filenamePWA.cached = filename;
				state.pwaFileState = PARAMETERS.PWA_FILE_STATE.CACHED;
				state.answer.answer = filename;
			},
			onFileErrorPWA(error) {
				state.fileError = error;
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
			...methods,
			...props,
			...computedScope,
			//icons
			camera,
			images
		};
	}
};
</script>

<style lang="scss" scoped>
</style>