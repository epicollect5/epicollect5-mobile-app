<template>
	<ion-header>
		<ion-toolbar>
			<ion-title
				class="ion-text-center"
				color="dark"
			>{{labels.recording_audio}}</ion-title>
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
							@click="stop()"
							class="question-action-button"
							color="secondary"
							expand="block"
						>
							<ion-icon
								slot="start"
								:icon="stopCircleSharp"
							>
							</ion-icon>
							{{labels.stop}}
						</ion-button>
					</ion-col>
				</ion-row>
			</ion-grid>
		</div>
	</ion-content>

</template>

<script>
import { modalController } from '@ionic/vue';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { PARAMETERS } from '@/config';
import { readonly, toRefs } from 'vue';

import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

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
		const protocol = '';
		let mediaRecorder = {};
		const { entryUuid, media, inputRef } = readonly(props);
		let filename;

		//if we do not have done any recording yet, generate a new file name
		if (media[entryUuid][inputRef].cached === '') {
			//check if we have a stored filename, i.e user is replacing the photo for the entry
			if (media[entryUuid][inputRef].stored === '') {
				//generate new file name, this is a brand new file
				filename = services.utilsService.generateMediaFilename(
					entryUuid,
					PARAMETERS.QUESTION_TYPES.AUDIO
				);
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
								services.notificationService.showAlert(error.code, labels.error);
								filename = '';
								modalController.dismiss(filename);
								console.log('recordAudio():Audio Error: ' + error.code);
								console.log('recordAudio():Audio Error: ' + JSON.stringify(error));
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

		const methods = {
			async stop() {
				//stop recording
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					await services.notificationService.showProgressDialog(labels.saving, labels.wait);

					//stop recording and release resources
					mediaRecorder.stopRecord();
					mediaRecorder.release();

					services.notificationService.hideProgressDialog();
					services.notificationService.showToast(labels.audio_saved);

					modalController.dismiss(filename);
				} else {
					modalController.dismiss(filename);
				}
				console.log('recordAudio():STOP----------');
			}
		};

		return {
			labels,
			...props,
			...icons,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
ion-content {
	--background: transparent;
}
ion-header {
	ion-toolbar {
		--background: transparent;
		ion-button,
		ion-icon {
			color: #333;
		}
	}
}
</style>