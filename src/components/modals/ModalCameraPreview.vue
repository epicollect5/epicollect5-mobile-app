<template>
	<div class="modal-camera-preview-layer">
	<div v-if="state.flash" class="camera-flash"></div>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-buttons slot="start">
				<ion-button @click="dismiss()">
					<ion-icon
						slot="icon-only"
						:icon="closeOutline"
					>
					</ion-icon>
				</ion-button>
			</ion-buttons>
			<div
				v-if="state.recording"
				slot="end"
				class="recording-indicator"
			>
				<span class="recording-dot"></span>
			</div>
		</ion-toolbar>
	</ion-header>
	<div class="camera-viewport"></div>
	<div class="camera-footer">
		<div class="camera-controls">
			<div class="camera-controls-side">
				<ion-button
					v-if="!isVideoMode"
					class="flip-button"
					@click="flip()"
				>
					<ion-icon
						slot="icon-only"
						:icon="cameraReverseOutline"
					>
					</ion-icon>
				</ion-button>
			</div>
			<button
				class="shutter-button"
				:class="{ 'recording': state.recording }"
				:disabled="state.capturing"
				@click="shutter()"
			>
			</button>
			<div class="camera-controls-side">
				<ion-button
					v-if="state.flashSupported"
					class="flash-button"
					:class="{ 'active': isFlashActive }"
					:disabled="!state.started"
					@click="toggleFlash()"
				>
					<ion-icon
						slot="icon-only"
						:icon="flashIcon"
					>
					</ion-icon>
				</ion-button>
			</div>
		</div>
	</div>
	</div>
</template>

<script>
import { reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { modalController } from '@ionic/vue';
import { closeOutline, cameraReverseOutline, flash, flashOutline } from 'ionicons/icons';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CameraPreview } from '@capgo/camera-preview';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

export default {
	props: {
		//'photo' keeps the current behaviour (shutter captures a photo); 'video'
		//turns the shutter into a record/stop toggle and enables the audio track
		mode: {
			type: String,
			default: 'photo'
		}
	},
	emits: ['on-dismiss'],
	setup(props, context) {
		const rootStore = useRootStore();
		const state = reactive({
			capturing: false,
			started: false,
			recording: false,
			flash: false,
			flashMode: 'off',
			//devices with no flash unit report only 'off', in which case the button is hidden
			flashSupported: false,
			torchSupported: false
		});

		let sourcePath = null;
		//true once a captured photo has been handed to the caller (photo-take): the
		//caller owns and deletes the file after consuming it, so unmount teardown
		//must NOT delete it (otherwise the resize read races this deletion and 404s)
		let sourceHandedOff = false;
		let appStateListener = null;
		let recordingListener = null;
		let appStateListenerPromise = null;
		let recordingListenerPromise = null;
		let flashTimer = null;
		//true while the app is in the background (screen off, app switcher, incoming
		//call): the camera is stopped to release it, and restarted on return so the
		//feed is live again instead of a frozen/blank viewport
		let appInactive = false;
		let startOptions = null;
		let restartInProgress = false;

		const computedScope = {
			//video mode hides the flip/flash controls (recording keeps the shutter as
			//the only control) and turns the shutter into a record/stop toggle
			isVideoMode: computed(() => props.mode === 'video'),
			isFlashActive: computed(() => state.flashMode !== 'off'),
			flashIcon: computed(() => state.flashMode !== 'off' ? flash : flashOutline)
		};

		//The native camera preview runs behind the WebView (toBack), so while the modal
		//is open the underlying app UI must not paint over it. Toggle a body/html class
		//(styled in ModalCameraPreview.scss) that hides the routed page and blanks the
		//root backgrounds, otherwise the question screen is shown instead of the camera
		function _setCameraLayerVisible(visible) {
			const rootElements = [document.documentElement, document.body];
			rootElements.forEach((element) => {
				element.classList.toggle('camera-preview-open', visible);
			});
		}

		async function _ensurePermission() {
			//video mode needs the microphone too (recording track); photos only need
			//the camera, so do not prompt for audio there
			const result = await CameraPreview.requestPermissions({
				disableAudio: !computedScope.isVideoMode.value,
				showSettingsAlert: true
			});
			if (result.camera !== 'granted' || (computedScope.isVideoMode.value && result.microphone !== 'granted')) {
				throw new Error('Camera permission denied');
			}
		}

		//Screen-off mid-recording can orphan a finalized file in the plugin's cache:
		//the native session dies before stopRecordVideo can return its path (and the
		//finalize may even be reported as failed while the file exists). Sweep the
		//plugin's recording directory before each video session so the cache cannot
		//accumulate recordings over time.
		async function _clearStaleRecordings() {
			//the embedded camera is Android-only: skip the sweep elsewhere
			if (rootStore.device.platform !== PARAMETERS.ANDROID) {
				return;
			}
			try {
				const { files } = await Filesystem.readdir({
					path: 'Movies/CameraPreview',
					directory: Directory.External
				});
				for (const file of files) {
					if (!file.name.toLowerCase().endsWith('.mp4')) {
						continue;
					}
					try {
						await Filesystem.deleteFile({
							path: 'Movies/CameraPreview/' + file.name,
							directory: Directory.External
						});
					} catch (error) {
						console.log('CameraPreview stale recording delete failed: ' + error);
					}
				}
			} catch (error) {
				//readdir fails when the directory does not exist yet (first run): non-fatal
				console.log('CameraPreview stale recordings read failed: ' + error);
			}
		}

		async function _start() {
			await _ensurePermission();
			if (computedScope.isVideoMode.value) {
				await _clearStaleRecordings();
			}
			if (!startOptions) {
				startOptions = {
					position: 'rear',
					toBack: true,
					storeToFile: true,
					//video mode binds the VideoCapture use case, which Android requires
					//for startRecordVideo, plus the audio track; photo sessions stay
					//silent and capture-only
					enableVideoMode: computedScope.isVideoMode.value,
					disableAudio: !computedScope.isVideoMode.value,
					//fill the whole WebView area (between the system bars) so the feed
					//extends over the white letterbox band at the bottom; cover crops the
					//stream sides instead of letterboxing (the plugin rejects aspectRatio
					//combined with explicit width/height, so no aspectRatio here)
					x: 0,
					y: 0,
					width: window.innerWidth,
					height: window.innerHeight,
					aspectMode: 'cover',
					//do not let the device rotate while the camera is open (rotating breaks
					//the layout); the plugin restores the previous orientation on stop()
					lockAndroidOrientation: true
				};
			}
			await CameraPreview.start(startOptions);
			//On edge-to-edge Android the plugin offsets the native layer by the WebView's
			//screen-top inset (it computes y=0 + inset) WITHOUT shrinking the height, so the
			//layer hangs one inset below the WebView and the live feed leaks through the
			//system-nav area (below the modal's opaque footer). Repositioning with
			//x=0/y=0 takes the plugin's full-screen code path, which applies no inset,
			//and aligns the native layer's bottom with the WebView's bottom.
			try {
				await CameraPreview.setPreviewSize({
					x: 0,
					y: 0,
					width: window.innerWidth,
					height: window.innerHeight
				});
			} catch (error) {
				console.log('CameraPreview.setPreviewSize failed: ' + error);
			}
			state.started = true;
			await _syncFlashMode();
		}

		async function _syncFlashMode() {
			//which modes the active (rear) camera supports: off, on, auto, torch
			try {
				const { result } = await CameraPreview.getSupportedFlashModes();
				const supported = result || [];
				state.torchSupported = supported.includes('torch');
				state.flashSupported = state.torchSupported || supported.includes('on');
			} catch (error) {
				console.log('CameraPreview.getSupportedFlashModes failed: ' + error);
				state.torchSupported = false;
				state.flashSupported = false;
				return;
			}
			//reflect the actual native state (e.g. after a flip the camera may reset it)
			try {
				const { flashMode } = await CameraPreview.getFlashMode();
				state.flashMode = flashMode || 'off';
			} catch (error) {
				console.log('CameraPreview.getFlashMode failed: ' + error);
			}
		}

		async function toggleFlash() {
			if (!state.started || !state.flashSupported) {
				return;
			}
			const target = state.flashMode === 'off'
				? (state.torchSupported ? 'torch' : 'on')
				: 'off';
			try {
				await CameraPreview.setFlashMode({ flashMode: target });
				state.flashMode = target;
			} catch (error) {
				console.log('CameraPreview.setFlashMode failed: ' + error);
			}
		}

		async function _stop() {
			if (!state.started) {
				return;
			}
			try {
				await CameraPreview.stop({ force: true });
			} catch (error) {
				console.log('CameraPreview.stop failed: ' + error);
			}
			state.started = false;
		}

		async function _cleanupSource() {
			//a handed-off capture must survive until the caller has resized it
			if (!sourcePath || sourceHandedOff) {
				return;
			}
			try {
				await CameraPreview.deleteFile({ path: sourcePath });
			} catch (error) {
				console.log('CameraPreview.deleteFile failed: ' + error);
			}
			sourcePath = null;
		}

		async function capture() {
			if (state.capturing || !state.started) {
				return;
			}
			state.capturing = true;
			//brief white flash as capture feedback
			state.flash = true;
			flashTimer = setTimeout(() => {
				state.flash = false;
			}, 250);
			try {
				const result = await CameraPreview.capture({
					width: 1024,
					height: 768,
					quality: 85,
					format: 'jpeg'
				});
				sourcePath = result.value;
				//hand the file to the caller; photo-take deletes it after resizing
				sourceHandedOff = true;
				await _stop();
				modalController.dismiss({ sourcePath });
			} catch (error) {
				console.log('CameraPreview.capture failed: ' + error);
				state.capturing = false;
			}
		}

		//=== video recording ===

		async function startRecording() {
			if (!state.started || state.recording || state.capturing) {
				return;
			}
			state.recording = true;
			try {
				//no artificial duration/size cap: the user decides when to stop
				await CameraPreview.startRecordVideo({});
			} catch (error) {
				console.log('CameraPreview.startRecordVideo failed: ' + error);
				state.recording = false;
			}
		}

		//hand the finished recording to the caller and close the modal
		async function _handOffRecording(videoFilePath) {
			if (!videoFilePath) {
				console.log('CameraPreview returned no video file path');
				return;
			}
			sourcePath = videoFilePath;
			//hand the file to the caller; video-shoot owns it from here on
			sourceHandedOff = true;
			await _stop();
			modalController.dismiss({ videoFilePath });
		}

		//stop the recording and hand the finished file to the caller (video-shoot)
		async function _finalizeRecording() {
			if (!state.recording) {
				return;
			}
			//reset first so a racing 'recordingFinished' event cannot re-enter
			state.recording = false;
			try {
				const { videoFilePath } = await CameraPreview.stopRecordVideo();
				await _handOffRecording(videoFilePath);
			} catch (error) {
				console.log('CameraPreview.stopRecordVideo failed: ' + error);
			}
		}

		//stop an in-progress recording and discard its partial file (user cancelled
		//via ✕ or the Android back button), so the plugin cache does not accumulate
		async function _abortRecording() {
			if (!state.recording) {
				return;
			}
			state.recording = false;
			try {
				const { videoFilePath } = await CameraPreview.stopRecordVideo();
				if (videoFilePath) {
					try {
						await CameraPreview.deleteFile({ path: videoFilePath });
					} catch (error) {
						console.log('CameraPreview.deleteFile failed: ' + error);
					}
				}
			} catch (error) {
				console.log('CameraPreview.stopRecordVideo failed: ' + error);
			}
		}

		//the shutter: captures a photo, or toggles the video recording
		async function shutter() {
			if (computedScope.isVideoMode.value) {
				if (state.recording) {
					await _finalizeRecording();
				} else {
					await startRecording();
				}
				return;
			}
			await capture();
		}

		async function flip() {
			if (!state.started) {
				return;
			}
			try {
				await CameraPreview.flip();
				//flash availability/mode may differ on the front camera, re-sync the toggle
				await _syncFlashMode();
			} catch (error) {
				console.log('CameraPreview.flip failed: ' + error);
			}
		}

		async function dismiss() {
			//a recording in progress must be stopped and its partial file discarded
			//before the camera is released, otherwise the file stays in the plugin cache
			if (computedScope.isVideoMode.value) {
				await _abortRecording();
			}
			await _stop();
			await _cleanupSource();
			context.emit('on-dismiss');
			modalController.dismiss();
		}

		async function _onAppStateChange({ isActive }) {
			//screen off / app backgrounded: release the camera (the plugin cannot hold
			//it while paused), but keep the modal up so the user returns to it
			if (!isActive && state.started) {
				appInactive = true;
				//screen off mid-recording: finalize the file if the native side still
				//can (the plugin pauses the session, which may already have stopped the
				//recording); on failure the recording is lost but the modal is not stuck
				if (computedScope.isVideoMode.value && state.recording) {
					await _finalizeRecording();
					if (sourceHandedOff) {
						return;
					}
				}
				await _stop();
				return;
			}
			//back in the foreground with the modal still open: bring the feed back to
			//life. Native resumes do not restart the session because _stop() (force)
			//clears the plugin's saved config, so restart explicitly.
			if (isActive && appInactive) {
				appInactive = false;
				if (restartInProgress) {
					return;
				}
				restartInProgress = true;
				try {
					await _start();
				} catch (error) {
					console.log('CameraPreview restart failed: ' + error);
					dismiss();
				} finally {
					restartInProgress = false;
				}
			}
		}

		onMounted(() => {
			_setCameraLayerVisible(true);
			_start().catch((error) => {
				console.log('CameraPreview.start failed: ' + error);
				dismiss();
			});
			//the native session may stop a recording on its own (max duration/file size,
			//or a screen-off teardown that finalizes the file before our stopRecordVideo
			//runs): use the event's path to complete the capture hand-off. When we stop
			//the recording ourselves the event fires too, but the recording flag was
			//already reset by _finalizeRecording, so it is skipped.
			if (computedScope.isVideoMode.value) {
				recordingListenerPromise = CameraPreview.addListener('recordingFinished', (data) => {
					if (state.recording) {
						state.recording = false;
						_handOffRecording(data && data.videoFilePath);
					}
				});
				recordingListenerPromise.then((handle) => {
					recordingListener = handle;
				});
			}
		});

		appStateListenerPromise = CapacitorApp.addListener('appStateChange', _onAppStateChange);
		appStateListenerPromise.then((handle) => {
			appStateListener = handle;
		});

		onBeforeUnmount(async () => {
			_setCameraLayerVisible(false);
			if (flashTimer) {
				clearTimeout(flashTimer);
				flashTimer = null;
			}
			//the Android back button can unmount the modal while a video is recording:
			//stop the recording and discard the partial file, same as the ✕ path
			if (computedScope.isVideoMode.value) {
				await _abortRecording();
			}
			await _stop();
			await _cleanupSource();
			//unmount may race listener registration: await the pending promises so
			//callbacks never stay registered on the destroyed modal
			if (recordingListenerPromise) {
				try {
					const handle = await recordingListenerPromise;
					recordingListener = recordingListener || handle;
				} catch (error) {
					console.log('CameraPreview recording listener registration failed: ' + error);
				}
			}
			if (appStateListenerPromise) {
				try {
					const handle = await appStateListenerPromise;
					appStateListener = appStateListener || handle;
				} catch (error) {
					console.log('CameraPreview app state listener registration failed: ' + error);
				}
			}
			if (recordingListener) {
				recordingListener.remove();
				recordingListener = null;
			}
			if (appStateListener) {
				appStateListener.remove();
				appStateListener = null;
			}
		});			return {
			state,
			...computedScope,
			shutter,
			capture,
			flip,
			toggleFlash,
			dismiss,
			closeOutline,
			cameraReverseOutline,
			flash,
			flashOutline
		};
	}
};
</script>

<style src="@/theme/components/modals/ModalCameraPreview.scss" lang="scss"></style>