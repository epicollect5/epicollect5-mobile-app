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
		//a double-tapped Stop must not stop the player twice: the first tap
		//exits through closeOnce below, so a second stop() would land on a
		//released object
		let stopping = false;
		//idempotent close: Stop and the status-4 callback converge here, so a
		//missing status callback cannot strand the modal (Stop still exits)
		//and a late callback after Stop cannot double-release/double-dismiss.
		//Release happens once ever; dismissal is confirmed, not assumed: a
		//failed dismiss leaves closed false and unlatches Stop, so another tap
		//or a later status callback retries instead of stranding the modal
		let closed = false;
		let released = false;
		function closeOnce() {
			if (closed) {
				return;
			}
			if (!released) {
				released = true;
				try {
					mediaPlayer.release();
				} catch (error) {
					console.log('audio release failed: ' + error);
				}
			}
			//dismiss is the modal exit: an already-dismissed overlay means the
			//modal is gone either way, anything else leaves the close open for
			//retry (a false-resolving dismiss dismissed nothing)
			Promise.resolve(modalController.dismiss()).then((result) => {
				if (result === false) {
					console.log('audio dismiss dismissed nothing, retryable');
					stopping = false;
				} else {
					closed = true;
				}
			}).catch((error) => {
				const gone = error === 'overlay does not exist'
					|| error?.message === 'overlay does not exist';
				if (gone) {
					closed = true;
				} else {
					console.log('audio dismiss failed: ' + error);
					stopping = false;
				}
			});
		}
		//callback when the audio finishes playing because it got to the end
		function _onPlayStatusChange(status) {
			console.log(status);
			//close modal and release media object
			if (status === 4) {
				closeOnce();
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
				if (stopping) {
					return;
				}
				stopping = true;
				try {
					//released implies a previous stop went through: a dismiss
					//retry must not re-stop an already released player
					if (!released) {
						mediaPlayer.stop();
					}
				} catch (error) {
					//this is the only control in the modal: let the user retry rather
					//than latching it off forever on a native stop failure
					stopping = false;
					throw error;
				}
				//exit here, not in the status callback: a native stop that never
				//sends status-4 would otherwise latch Stop and strand the modal
				closeOnce();
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

<style src="@/theme/components/modals/ModalAudioPlay.scss" lang="scss"></style>