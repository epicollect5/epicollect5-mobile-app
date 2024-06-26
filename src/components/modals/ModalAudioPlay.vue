<template>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-title
				data-translate="playing_audio"
				class="ion-text-center"
				color="dark"
			>{{ labels.playing_audio }}</ion-title>
		</ion-toolbar>
	</ion-header>
	<ion-content>
		<div class="ion-text-center ion-padding">
			<ion-icon
				color="dark"
				class="audio-note ion-text-center"
				:icon="musicalNote"
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
import { musicalNote, stopCircleSharp } from 'ionicons/icons';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { Capacitor } from '@capacitor/core';

export default {
	props: {
		projectRef: {
			type: String,
			required: true
		},
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
		const persistentDir = rootStore.persistentDir;
		const { entryUuid, media, inputRef, projectRef } = readonly(props);
		let mediaPlayer = {
			play: () => { return true; },
			stop: () => { return true; }
		};

		let file_URI;
		//callback when the audio finishes playing because it got to the end
		function _onPlayStatusChange(status) {
			console.log(status);
			//close modal and release media object
			if (status === 4) {
				mediaPlayer.release();
				modalController.dismiss();
			}
		}

		//play cached audio if any (and this wins over a stored audio file)
		if (media[entryUuid][inputRef].cached !== '') {
			file_URI = tempDir + media[entryUuid][inputRef].cached;
		} else {
			if (media[entryUuid][inputRef].stored !== '') {
				//play stored file
				file_URI =
					persistentDir +
					PARAMETERS.AUDIO_DIR +
					projectRef +
					'/' +
					media[entryUuid][inputRef].stored;
			}
		}

		if (Capacitor.isNativePlatform()) {
			mediaPlayer = new window.Media(
				file_URI,
				(success) => {
					console.log(success);
				},
				(error) => {
					console.log(error);
				},
				_onPlayStatusChange
			);
			mediaPlayer.play();
		}

		const methods = {
			stop() {
				mediaPlayer.stop();
			}
		};

		return {
			labels,
			...props,
			...methods,
			//icons
			musicalNote,
			stopCircleSharp
			//
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>