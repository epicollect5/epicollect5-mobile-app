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
			<grid-question-narrow>
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
import { modalController } from '@ionic/vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { mic, playSharp } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import ModalAudioPlay from '@/components/modals/ModalAudioPlay';
import ModalAudioRecord from '@/components/modals/ModalAudioRecord';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { rollbarService } from '@/services/utilities/rollbar-service';

//shared pending-open guard across all AudioNative instances: claimed
//synchronously before modal creation (play) or after mic permission is
//granted (top of _doRecord), released on failure/dismissal. Kept separate
//from rootStore.isAudioModalActive, which stays navigation-only (false
//during permission). Claimed after permission, not before, because the OS
//permission dialog blocks WebView taps, so no overlapping tap can land
//mid-permission; claiming earlier would strand the guard when the plugin
//never calls back (no dialog, UI still live).
let pendingAudioOpen = false;

export default {
	components: {
		GridQuestionNarrow,
		QuestionLabelAction
	},
	props: {
		parentState: {
			type: Object,
			required: true
		},
		entryUuid: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = props.parentState;

		const scope = {
			modalPlayAudio: {},
			modalAudioRecord: {}
		};

		//leading-edge tap guard shared by record() and play(): per-component
		//setup state, so it dies on unmount and never strands a new entry.
		//Rollback fails open (see isDoubleTap), unlike a claimed-until-released flag
		let lastAudioTap = 0;

		const projectRef = rootStore.entriesAddScope.entryService.entry.projectRef;
		const media = rootStore.entriesAddScope.entryService.entry.media;

		const computedScope = {
			isFileAvailable: computed(() => {
				return media[props.entryUuid][state.inputDetails.ref].cached !== ''
					|| media[props.entryUuid][state.inputDetails.ref].stored !== '';
			})
		};

		const methods = {
			async openPopover(e) {
				const mediaFile = media[props.entryUuid][state.inputDetails.ref];
				if (mediaFile.cached === '' && mediaFile.stored === '') {
					return false;
				}
				popoverMediaHandler({
					media,
					entryUuid: props.entryUuid,
					state,
					e,
					mediaType: PARAMETERS.QUESTION_TYPES.AUDIO
				});
			},
			record() {
				//leading-edge debounce (shared with play) plus a read-only
				//overlay check: a second tap inside the window, or any tap
				//while an audio open is pending or an overlay is up, is dropped.
				//imp: pendingAudioOpen is claimed after mic permission is granted
				//(top of _doRecord), not here. The OS permission dialog blocks
				//WebView taps, so no overlapping tap can land mid-permission;
				//claiming earlier would strand the guard when the plugin never
				//calls back (no dialog, UI still live). isAudioModalActive stays
				//navigation-only (false during permission).
				if (pendingAudioOpen
					|| rootStore.isAudioModalActive
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
								rollbarService.criticalWithContext('audioRecord permission failed', error);
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
								rollbarService.criticalWithContext('audioRecord permission failed', error);
								notificationService.showAlert(error);
							}
						);
					}
				}
			},
			async play() {
				//same debounce as record(): both actions share one window,
				//so play cannot stack a second player on top of an in-flight
				//record or play either. The pending guard is claimed synchronously
				//here, before the first await, so taps from any instance are dropped.
				if (pendingAudioOpen
					|| rootStore.isAudioModalActive
					|| utilsService.isDoubleTap(lastAudioTap, PARAMETERS.DELAY_LONG)) {
					return;
				}
				lastAudioTap = Date.now();
				pendingAudioOpen = true;
				try {
					scope.ModalAudioPlay = await modalController.create({
						cssClass: 'modal-audio-play',
						component: ModalAudioPlay,
						showBackdrop: true,
						backdropDismiss: false,
						componentProps: {
							projectRef,
							inputRef: state.inputDetails.ref,
							entryUuid: props.entryUuid,
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
					rollbarService.criticalWithContext('audioPlay open failed', error);
					notificationService.showAlert(error.message || labels.unknown_error);
				} finally {
					pendingAudioOpen = false;
				}
			}
		};

		//the recorder modal is opened fire-and-forget from the permission
		//callback: surface a failed open instead of an unhandled rejection
		//(same as photo/video, same as play() above)
		function _onRecordOpenError(error) {
			console.log('Audio record failed: ' + error);
			rollbarService.criticalWithContext('audioRecord open failed', error);
			notificationService.showAlert((error && error.message) || labels.unknown_error);
		}

		async function _doRecord() {
			//second granted callback racing an in-flight open is dropped here:
			//the OS dialog blocks WebView taps mid-permission, so this only
			//covers the granted fast path and programmatic double-invocation
			if (pendingAudioOpen || rootStore.isAudioModalActive) {
				return;
			}
			//claimed synchronously before the first await, released below on
			//every path (failure, dismissal); isAudioModalActive stays
			//navigation-only and is claimed only once presenting
			pendingAudioOpen = true;
			try {
				scope.modalAudioRecord = await modalController.create({
					cssClass: 'modal-audio-record',
					component: ModalAudioRecord,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						inputRef: state.inputDetails.ref,
						entryUuid: props.entryUuid,
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
						media[props.entryUuid][state.inputDetails.ref].cached = filename;
					}
				});
				rootStore.isAudioModalActive = true;
				try {
					await scope.modalAudioRecord.present();
					await dismissed;
				} finally {
					rootStore.isAudioModalActive = false;
				}
			} finally {
				pendingAudioOpen = false;
			}
		}

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			mic,
			playSharp
		};
	}
};
</script>

<style src="@/theme/components/platform/AudioNative.scss" lang="scss" scoped></style>
