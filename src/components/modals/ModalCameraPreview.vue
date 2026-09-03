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
		</ion-toolbar>
	</ion-header>
	<div class="camera-viewport"></div>
	<div class="camera-footer">
		<div class="camera-controls">
			<ion-button
				class="flip-button"
				@click="flip()"
			>
				<ion-icon
					slot="icon-only"
					:icon="cameraReverseOutline"
				>
				</ion-icon>
			</ion-button>
			<button
				class="shutter-button"
				:disabled="state.capturing"
				@click="capture()"
			>
			</button>
			<div
				class="camera-controls-side"
				style="width: 48px;"
			>
				<ion-button
					v-if="state.flashSupported"
					class="flash-button"
					:class="{ 'active': state.flashMode !== 'off' }"
					:disabled="!state.started"
					@click="toggleFlash()"
				>
					<ion-icon
						slot="icon-only"
						:icon="state.flashMode !== 'off' ? flash : flashOutline"
					>
					</ion-icon>
				</ion-button>
			</div>
		</div>
	</div>
	</div>
</template>

<script>
import { reactive, onMounted, onBeforeUnmount } from 'vue';
import { modalController } from '@ionic/vue';
import { closeOutline, cameraReverseOutline, flash, flashOutline } from 'ionicons/icons';
import { App as CapacitorApp } from '@capacitor/app';
import { CameraPreview } from '@capgo/camera-preview';

export default {
	emits: ['on-dismiss'],
	setup(_props, context) {
		const state = reactive({
			capturing: false,
			started: false,
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
		let flashTimer = null;
		//true while the app is in the background (screen off, app switcher, incoming
		//call): the camera is stopped to release it, and restarted on return so the
		//feed is live again instead of a frozen/blank viewport
		let appInactive = false;
		let startOptions = null;
		let restartInProgress = false;

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
			const result = await CameraPreview.requestPermissions({
				disableAudio: true,
				showSettingsAlert: true
			});
			if (result.camera !== 'granted') {
				throw new Error('Camera permission denied');
			}
		}

		async function _start() {
			await _ensurePermission();
			if (!startOptions) {
				startOptions = {
					position: 'rear',
					toBack: true,
					storeToFile: true,
					disableAudio: true,
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
		});

		CapacitorApp.addListener('appStateChange', _onAppStateChange).then((handle) => {
			appStateListener = handle;
		});

		onBeforeUnmount(async () => {
			_setCameraLayerVisible(false);
			if (flashTimer) {
				clearTimeout(flashTimer);
				flashTimer = null;
			}
			await _stop();
			await _cleanupSource();
			if (appStateListener) {
				appStateListener.remove();
				appStateListener = null;
			}
		});			return {
			state,
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
