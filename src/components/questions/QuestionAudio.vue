<template>
	<ion-card
		class="question-card"
		:class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:key="state.answer.answer"
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
			:class="{ 'ion-margin': isGroupInput }"
		>
			<dropzone
				:filestate="state.pwaFileState"
				:filename="state.answer.answer"
				:fileError="state.fileError"
				:key="state.answer.answer"
				v-if="isPWA"
				:type="state.inputDetails.type"
				:inputRef="state.inputDetails.ref"
				:uuid="entryUuid"
				@file-loaded="onFileLoadedPWA"
				@file-dropped="onFileDroppedPWA"
				@file-error="onFileErrorPWA"
			></dropzone>

			<grid-question-narrow v-if="!isPWA">
				<template #content>
					<ion-button
						class="question-action-button ion-text-nowrap"
						color="secondary"
						expand="block"
						@click="record()"
					>
						<ion-icon
							slot="start"
							:icon="mic"
						></ion-icon>
						{{ labels.record }}
					</ion-button>
				</template>
			</grid-question-narrow>

			<grid-question-narrow
				v-if="!isPWA"
				class="ion-margin-top"
			>
				<template #content>
					<ion-button
						:disabled="!isFileAvailable"
						class="question-action-button ion-text-nowrap"
						color="secondary"
						expand="block"
						@click="play()"
					>
						<ion-icon
							slot="start"
							:icon="playSharp"
						></ion-icon>
						{{ labels.play }}
					</ion-button>
				</template>
			</grid-question-narrow>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { modalController } from '@ionic/vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { mic, playSharp } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import ModalAudioPlay from '@/components/modals/ModalAudioPlay';
import ModalAudioRecord from '@/components/modals/ModalAudioRecord';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
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
			filename: '',
			ongoingAction: '',
			pwaFileState: PARAMETERS.PWA_FILE_STATE.CACHED,
			fileError: labels.unknown_error
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

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
			}),
			isFileAvailable: computed(() => {
				const mediaFile = media[entryUuid][state.inputDetails.ref];

				if (rootStore.isPWA) {
					return mediaFile.filenamePWA.cached !== '' || mediaFile.filenamePWA.stored !== '';
				}
				return mediaFile.cached !== '' || mediaFile.stored !== '';
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

		const scope = {
			modalPlayAudio: {},
			modalAudioRecord: {}
		};

		//leading-edge tap guard shared by record() and play(): per-component
		//setup state, so it dies on unmount and never strands a new entry.
		//The clock only moves forward, unlike a claimed-until-released flag
		let lastAudioTap = 0;

		const projectRef = entriesAddScope.entryService.entry.projectRef;
		const media = entriesAddScope.entryService.entry.media;
		// Check whether we want to index the media object using the main entry uuid, or branch entry uuid
		const entryUuid = !entriesAddState.questionParams.isBranch
			? entriesAddScope.entryService.entry.entryUuid //use entry_uuid
			: entriesAddScope.branchEntryService.entry.
				entryUuid;//use branch entry_uuid 

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
					state.answer.answer = media[entryUuid][state.inputDetails.ref].filenamePWA.cached;
					state.pwaFileState = PARAMETERS.PWA_FILE_STATE.CACHED;
				} else {
					if (media[entryUuid][state.inputDetails.ref].filenamePWA.stored !== '') {
						state.answer.answer = media[entryUuid][state.inputDetails.ref].filenamePWA.stored;
						state.pwaFileState = PARAMETERS.PWA_FILE_STATE.STORED;
					}
				}
			}
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
					mediaType: PARAMETERS.QUESTION_TYPES.AUDIO
				});
			},
			record() {
				//leading-edge debounce (shared with play) plus a read-only
				//overlay check: a second tap inside the window, or any tap
				//while an audio overlay is up, is dropped. A double permission
				//prompt is benign (the plugin dedupes concurrent requests
				//with an "already in progress" error), and 98.3.1 field
				//testing showed the granted fast path (stacked modals,
				//last wins) needs no strandable latch either
				if (rootStore.isAudioModalActive
					|| utilsService.isDoubleTap(lastAudioTap, PARAMETERS.DELAY_LONG)) {
					return;
				}
				lastAudioTap = Date.now();
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					if (rootStore.device.platform === PARAMETERS.ANDROID) {
						//android permission
						console.log(cordova.plugins);
						cordova.plugins.diagnostic.requestRuntimePermission(
							(status) => {
								if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
									console.log('Permission granted');
									_doRecord().catch(_onRecordOpenError);
								} else {
									//warn user the permission is required
									notificationService.showAlert(labels.missing_permission);
								}
							},
							function (error) {
								console.error('The following error occurred: ' + error);
								notificationService.showAlert(error);
							},
							cordova.plugins.diagnostic.permission.RECORD_AUDIO
						);
					} else {
						//ios permission if needed
						window.cordova.plugins.diagnostic.requestMicrophoneAuthorization(
							function (status) {
								if (status === 'authorized' || status === 1) {
									console.log('Permission granted');
									_doRecord().catch(_onRecordOpenError);
								} else {
									//warn user the permission is required
									notificationService.showAlert(labels.missing_permission);
								}
							},
							function (error) {
								console.error(error);
								notificationService.showAlert(error);
							}
						);
					}
				}
			},
			async play() {
				//same debounce as record(): both actions share one window,
				//so play cannot stack a second player on top of an in-flight
				//record or play either
				if (rootStore.isAudioModalActive
					|| utilsService.isDoubleTap(lastAudioTap, PARAMETERS.DELAY_LONG)) {
					return;
				}
				lastAudioTap = Date.now();
				try {
					scope.ModalAudioPlay = await modalController.create({
						cssClass: 'modal-audio-play',
						component: ModalAudioPlay,
						showBackdrop: true,
						backdropDismiss: false,
						componentProps: {
							projectRef,
							inputRef: state.inputDetails.ref,
							entryUuid,
							media
						}
					});

					//the overlay gate is claimed only once it is actually being presented, and
					//released only once the user has closed the modal: present() resolves as
					//soon as the overlay is on screen and playback keeps running after it,
					//and a rejected present() must not strand the gate
					const dismissed = scope.ModalAudioPlay.onDidDismiss();
					rootStore.isAudioModalActive = true;
					try {
						await scope.ModalAudioPlay.present();
						await dismissed;
					} finally {
						rootStore.isAudioModalActive = false;
					}
				} catch (error) {
					//the player could not be presented: surface it, a failed
					//open must never be silent (same as photo/video)
					console.log('Audio play failed: ' + error);
					notificationService.showAlert(error.message || labels.unknown_error);
				}
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

		//the recorder modal is opened fire-and-forget from the permission
		//callback: surface a failed open instead of an unhandled rejection
		//(same as photo/video, same as play() above)
		function _onRecordOpenError(error) {
			console.log('Audio record failed: ' + error);
			notificationService.showAlert((error && error.message) || labels.unknown_error);
		}

		async function _doRecord() {
			scope.modalAudioRecord = await modalController.create({
				cssClass: 'modal-audio-record',
				component: ModalAudioRecord,
				showBackdrop: true,
				backdropDismiss: false,
				componentProps: {
					inputRef: state.inputDetails.ref,
					entryUuid,
					media
				}
			});

			//settle on dismissal, not presentation: the overlay gate stays
			//claimed while the recorder is open, so back-button navigation
			//cannot leave the question mid-recording
			const dismissed = scope.modalAudioRecord.onDidDismiss().then((response) => {
				console.log('filename is: ', response.data);
				const filename = response.data;
				//a dismissal carrying no filename (no recording made) must leave the
				//answer and the media reference untouched: writing an undefined here
				//would point the entry at a file that does not exist and break the
				//save with FileError 1
				if (filename) {
					state.answer.answer = filename;
					media[entryUuid][state.inputDetails.ref].cached = filename;
				}
			});
			rootStore.isAudioModalActive = true;
			try {
				await scope.modalAudioRecord.present();
				await dismissed;
			} finally {
				rootStore.isAudioModalActive = false;
			}
		}

		return {
			labels,
			state,
			entryUuid,

			...computedScope,
			...methods,
			...props,
			//icons
			mic,
			playSharp
		};
	}
};
</script>

<style src="@/theme/components/questions/QuestionAudio.scss" lang="scss"></style>