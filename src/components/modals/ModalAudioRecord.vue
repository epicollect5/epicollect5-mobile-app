<template>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-title
				data-translate="recording_audio"
				class="ion-text-center"
				color="dark"
			>{{ labels.recording_audio }}</ion-title>
		</ion-toolbar>
	</ion-header>
	<ion-content>
		<div class="ion-text-center ion-padding">
			<ion-icon
				color="dark"
				class="audio-mic ion-text-center"
				:icon="micCircleOutline"
			>
			</ion-icon>
		</div>
		<div class="ion-text-center">
			<ion-spinner
				class=""
				name="dots"
			></ion-spinner>
		</div>
		<div class="ion-text-center ion-padding-top">
			<ion-grid>
				<ion-row>
					<ion-col
						size="8"
						offset="2"
					>
						<ion-button
							data-translate="stop"
							data-test="stop"
							@click="stop()"
							class="question-action-button ion-text-nowrap"
							color="secondary"
							expand="block"
						>
							<ion-icon
								slot="start"
								:icon="stopCircleSharp"
							>
							</ion-icon>
							{{ labels.stop }}
						</ion-button>
					</ion-col>
				</ion-row>
			</ion-grid>
		</div>
	</ion-content>
</template>

<script>
import { modalController } from '@ionic/vue';
import { micCircleOutline, stopCircleSharp } from 'ionicons/icons';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { utilsService } from '@/services/utilities/utils-service';
import { rollbarService } from '@/services/utilities/rollbar-service';
import { notificationService } from '@/services/notification-service';

export default {
	props: {
		entryUuid: {
			type: String,
			required: true
		},
		inputRef: {
			type: String,
			required: true
		},
		media: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const tempDir = rootStore.tempDir;
		let mediaRecorder = {};
		const { entryUuid, media, inputRef } = readonly(props);
		let filename;

		//if we do not have done any recording yet, generate a new file name
		if (media[entryUuid][inputRef].cached === '') {
			//check if we have a stored filename, i.e. user is replacing the photo for the entry
			if (media[entryUuid][inputRef].stored === '') {
				//generate new file name, this is a brand-new file
				filename = utilsService.generateMediaFilename(entryUuid, PARAMETERS.QUESTION_TYPES.AUDIO);
			} else {
				//use stored filename
				filename = media[entryUuid][inputRef].stored;
			}
		} else {
			//use the cached path not to fill the cache with a new file all the time
			filename = media[entryUuid][inputRef].cached;
		}

		//console.log('Recording... - Full path: ' + tempDir + filename);
		if (rootStore.device.platform !== PARAMETERS.WEB) {
			const protocol = rootStore.device.platform === PARAMETERS.IOS ? 'file://' : '';

			//create file first, protocol 'file://' is added for ios
			//file is created in app private cache dir
			window.resolveLocalFileSystemURL(
				protocol + tempDir,
				function (dir) {
					dir.getFile(filename, { create: true }, function (file) {
						console.log('got the file', file);

						//protocol here is not needed,
						//if there is the 'file://' ios will give an error 'Failed to start recording using AVAudioRecorder'
						mediaRecorder = new window.Media(
							tempDir + filename,
							function onRecordingSuccess() {
								console.log('recordAudio():Audio Success');
								console.log('current_path: ' + tempDir + filename);
							},
							function onRecordingError(error) {
								//the dismissal below carries an empty filename, which the
								//question reads as a cancel: report here or the native
								//failure is untraceable
								rollbarService.criticalWithContext('audioRecord recording failed', error);
								notificationService.showAlert(error.code, labels.error);
								filename = '';
								modalController.dismiss(filename);
								console.log('recordAudio():Audio Error: ' + error.code);
								console.log('recordAudio():Audio Error: ' + JSON.stringify(error));
							},
							function onStatusChange(status) {
								console.log(status);
							}
						);
						// Record audio
						mediaRecorder.startRecord();
					});
				},
				function (error) {
					console.log(error);
				}
			);
		}

		//a double-tapped Stop must not release the native recorder twice (the
		//second release throws and the second dismiss rejects with
		//overlay-does-not-exist), nor stack two saving dialogs
		let stopping = false;
		//split-phase retry: stop and release are each done once, a later
		//failure (release, dismiss) must not repeat a completed phase
		let stopCompleted = false;
		let released = false;

		const methods = {
			async stop() {
				if (stopping) {
					return;
				}
				//claimed before the first await: the saving dialog below yields long
				//enough for a second tap to get through, and would then stop and
				//release the already-released recorder
				stopping = true;
				//tracks whether this stop() presented the saving dialog: the dialog
				//is global, so the catch below must only hide what it showed,
				//otherwise a failed show (or a web dismiss failure) would dismiss
				//another operation's indicator. The handle snapshot narrows it
				//further: if another operation replaced the dialog since, its
				//owner hides it, not us (residual: the hide itself is delayed, so
				//a swap inside that window still races - owned by the service)
				let dialogShown = false;
				let ownDialog = null;
				try {
					//stop recording
					let dismissed = true;
					if (rootStore.device.platform !== PARAMETERS.WEB) {
						await notificationService.showProgressDialog(labels.saving, labels.wait);
						dialogShown = true;
						ownDialog = rootStore.ec5LoadingDialog;

						//stop recording and release resources: each phase runs once,
						//a retry after a later failure skips completed phases
						if (!stopCompleted) {
							mediaRecorder.stopRecord();
							stopCompleted = true;
						}
						if (!released) {
							mediaRecorder.release();
							released = true;
						}

						notificationService.hideProgressDialog();
						notificationService.showToast(labels.audio_saved);

						//awaited: a rejected dismiss must unlatch Stop below instead
						//of stranding the modal with no working exit
						dismissed = await modalController.dismiss(filename);
					} else {
						dismissed = await modalController.dismiss(filename);
					}
					if (dismissed === false) {
						//nothing was dismissed and the modal is still open: leave
						//Stop usable so the user can retry the exit
						stopping = false;
						return;
					}
					console.log('recordAudio():STOP----------');
				} catch (error) {
					//the saving dialog was already presented above: hide it before
					//handing control back, otherwise it sticks over the modal when
					//stopRecord(), release() or the modal dismiss throws. Only hides
					//what this stop() showed and still owns: a failed show - or a
					//dialog since replaced by another operation - is left alone.
					//This is the only control in the modal: let the user retry
					//rather than latching it off forever on a failure
					if (dialogShown && rootStore.ec5LoadingDialog === ownDialog) {
						notificationService.hideProgressDialog();
					}
					rollbarService.criticalWithContext('audioRecord stop failed', error);
					stopping = false;
					throw error;
				}
			}
		};

		return {
			labels,
			...props,
			...methods,
			//icons
			micCircleOutline,
			stopCircleSharp
		};
	}
};
</script>

<style src="@/theme/components/modals/ModalAudioRecord.scss" lang="scss"></style>
