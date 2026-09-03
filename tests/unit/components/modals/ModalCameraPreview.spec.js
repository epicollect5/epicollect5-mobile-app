import ModalCameraPreview from '@/components/modals/ModalCameraPreview.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import flushPromises from 'flush-promises';

const platformMock = vi.hoisted(() => ({ platform: 'android' }));

const mocks = vi.hoisted(() => {
	const cameraPreview = {
		requestPermissions: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
		capture: vi.fn(),
		deleteFile: vi.fn(),
		flip: vi.fn(),
		getSupportedFlashModes: vi.fn(),
		getFlashMode: vi.fn(),
		setFlashMode: vi.fn(),
		setPreviewSize: vi.fn(),
		startRecordVideo: vi.fn(),
		stopRecordVideo: vi.fn(),
		addListener: vi.fn()
	};
	const filesystem = {
		readdir: vi.fn(),
		deleteFile: vi.fn()
	};
	const capacitorApp = {
		addListener: vi.fn()
	};
	const modalController = {
		dismiss: vi.fn()
	};
	return { cameraPreview, filesystem, capacitorApp, modalController };
});

vi.mock('@capgo/camera-preview', () => ({
	CameraPreview: mocks.cameraPreview
}));

vi.mock('@capacitor/app', () => ({
	App: mocks.capacitorApp
}));

vi.mock('@capacitor/filesystem', () => ({
	Filesystem: mocks.filesystem,
	Directory: { External: 'EXTERNAL' }
}));

vi.mock('@ionic/vue', () => ({
	modalController: mocks.modalController
}));

vi.mock('@/stores/root-store', () => ({
	useRootStore: () => ({ device: { platform: platformMock.platform } })
}));

vi.mock('@/config', () => ({
	PARAMETERS: { ANDROID: 'android' }
}));

const expectStartOptions = () =>
	expect.objectContaining({
		toBack: true,
		storeToFile: true,
		//the feed fills the whole area between the system bars (cover crops the
		//stream sides; the plugin rejects aspectRatio with explicit width/height)
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
		aspectMode: 'cover',
		//no rotation while the camera is open (plugin restores on stop)
		lockAndroidOrientation: true
	});

function grantPermissions({ camera = 'granted', microphone = 'granted', flashModes = ['off', 'on', 'auto', 'torch'] } = {}) {
	mocks.cameraPreview.requestPermissions.mockResolvedValue({ camera, microphone });
	mocks.cameraPreview.start.mockResolvedValue();
	mocks.cameraPreview.stop.mockResolvedValue();
	mocks.cameraPreview.capture.mockRejectedValue(new Error('not capturing in this test'));
	mocks.cameraPreview.deleteFile.mockResolvedValue({ success: true });
	mocks.cameraPreview.flip.mockResolvedValue();
	mocks.cameraPreview.getSupportedFlashModes.mockResolvedValue({ result: flashModes });
	mocks.cameraPreview.getFlashMode.mockResolvedValue({ flashMode: 'off' });
	mocks.cameraPreview.setFlashMode.mockResolvedValue();
	mocks.cameraPreview.setPreviewSize.mockResolvedValue();
	mocks.cameraPreview.startRecordVideo.mockResolvedValue();
	mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/rec.mp4' });
	mocks.cameraPreview.addListener.mockResolvedValue({ remove: vi.fn() });
	mocks.capacitorApp.addListener.mockResolvedValue({ remove: vi.fn() });
	mocks.filesystem.readdir.mockResolvedValue({ files: [] });
	mocks.filesystem.deleteFile.mockResolvedValue();
}

describe('ModalCameraPreview component', () => {

	beforeEach(() => {
		vi.clearAllMocks();
		platformMock.platform = 'android';
		document.documentElement.classList.remove('camera-preview-open');
		document.body.classList.remove('camera-preview-open');
	});

	afterEach(() => {
		//the capture feedback timer must not leak across tests
		vi.clearAllTimers();
	});

	it('hides the underlying app UI while mounted so the native camera layer is visible', async () => {
		grantPermissions();

		const wrapper = shallowMount(ModalCameraPreview);
		await Promise.resolve();
		expect(document.documentElement.classList.contains('camera-preview-open')).toBe(true);
		expect(document.body.classList.contains('camera-preview-open')).toBe(true);
		await flushPromises();
		expect(mocks.cameraPreview.requestPermissions).toHaveBeenCalled();
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expectStartOptions());
		//on edge-to-edge Android the plugin offsets the native layer by the WebView's
		//top inset without shrinking it; x=0/y=0 takes the plugin's no-inset full-screen
		//path and realigns the layer bottom with the WebView bottom (no feed leak)
		expect(mocks.cameraPreview.setPreviewSize).toHaveBeenCalledWith({
			x: 0,
			y: 0,
			width: window.innerWidth,
			height: window.innerHeight
		});

		wrapper.unmount();
		expect(document.documentElement.classList.contains('camera-preview-open')).toBe(false);
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('dismisses the modal when the camera permission is denied', async () => {
		grantPermissions({ camera: 'denied' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		wrapper.unmount();
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('keeps the camera running when the edge-to-edge repositioning fails', async () => {
		grantPermissions();
		mocks.cameraPreview.setPreviewSize.mockRejectedValue(new Error('layout busy'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//the repositioning is best-effort: without it the feed may leak into the nav
		//area on edge-to-edge devices, but the camera itself must still be usable
		expect(mocks.cameraPreview.setPreviewSize).toHaveBeenCalled();
		expect(wrapper.vm.state.started).toBe(true);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
	});

	it('dismisses the modal when the camera cannot be started', async () => {
		grantPermissions();
		mocks.cameraPreview.start.mockRejectedValue(new Error('camera in use'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//dismissal is requested; the underlying app UI stays hidden until the modal
		//content is actually unmounted (mock dismiss does not unmount, so do it manually)
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		wrapper.unmount();
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('toggles the torch flash mode on and off', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(mocks.cameraPreview.getSupportedFlashModes).toHaveBeenCalled();
		expect(wrapper.vm.state.flashSupported).toBe(true);
		expect(wrapper.vm.state.torchSupported).toBe(true);

		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenCalledWith({ flashMode: 'torch' });
		expect(wrapper.vm.state.flashMode).toBe('torch');

		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenLastCalledWith({ flashMode: 'off' });
		expect(wrapper.vm.state.flashMode).toBe('off');
	});

	it('toggles a plain flash (on, no torch) when the camera has no torch unit', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(wrapper.vm.state.flashSupported).toBe(true);
		expect(wrapper.vm.state.torchSupported).toBe(false);

		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenCalledWith({ flashMode: 'on' });
		expect(wrapper.vm.state.flashMode).toBe('on');

		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenLastCalledWith({ flashMode: 'off' });
	});

	it('hides the flash toggle when the camera has no flash unit', async () => {
		grantPermissions({ flashModes: ['off'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(wrapper.vm.state.flashSupported).toBe(false);
		expect(wrapper.vm.state.torchSupported).toBe(false);

		//tapping the toggle is a no-op, not a native call
		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).not.toHaveBeenCalled();
	});

	it('flips to the front camera and re-syncs flash support for it', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//the front camera on this device reports no flash support
		mocks.cameraPreview.getSupportedFlashModes.mockResolvedValue({ result: ['off'] });
		await wrapper.vm.flip();

		expect(mocks.cameraPreview.flip).toHaveBeenCalled();
		//front cameras usually lack a flash unit; the toggle must adapt after the flip
		expect(mocks.cameraPreview.getSupportedFlashModes).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.flashSupported).toBe(false);
	});

	it('captures a photo, stops the camera and hands the file to the caller', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).toHaveBeenCalledWith({
			width: 1024,
			height: 768,
			quality: 85,
			format: 'jpeg'
		});
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.started).toBe(false);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg' });

		//unmounting the modal (which is what happens when photo-take resumes and resizes
		//the photo) must not delete the handed-off file: photo-take owns it now
		wrapper.unmount();
		await flushPromises();
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
	});

	it('recovers from a failed capture without dismissing the modal', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockRejectedValue(new Error('capture failed'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).toHaveBeenCalled();
		expect(wrapper.vm.state.capturing).toBe(false);
		expect(wrapper.vm.state.started).toBe(true);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
	});

	it('ignores a shutter press while the camera is not started', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		//camera not running (e.g. released while backgrounded): the shutter is disabled
		wrapper.vm.state.started = false;

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).not.toHaveBeenCalled();
		expect(wrapper.vm.state.capturing).toBe(false);
	});

	it('recovers when stopping the camera after a capture fails (no double dismiss)', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//capture succeeded and handed the file off, but the native stop raced/failed:
		//the modal stays open and the user can retry the shutter, not a dead end
		mocks.cameraPreview.stop.mockRejectedValueOnce(new Error('session busy'));
		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).toHaveBeenCalled();
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);

		//teardown must not delete the file photo-take already owns (sourceHandedOff)
		wrapper.unmount();
		await flushPromises();
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
	});

	it('stops the camera and releases the UI layer when dismissed before capturing', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.dismiss();
		await flushPromises();

		//the ✕ button: release the camera and close without handing over any photo
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
	});

	it('stops the camera when the modal is closed by the Android back button', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalled();

		//the Android back button dismisses the overlay through Ionic (backdropDismiss
		//on the modal, see photo-take.js), which unmounts this component; make sure
		//the teardown stops the native camera and releases the UI layer
		wrapper.unmount();
		await flushPromises();

		expect(mocks.cameraPreview.stop).toHaveBeenCalled();
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('restarts the feed when the app returns to the foreground after being backgrounded', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);

		//screen off / app switcher: the app reports inactive and the camera is stopped
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.started).toBe(false);
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);

		//back in the foreground while the modal is still presented: the feed restarts
		//(native resumes do not, because the forced stop cleared the plugin's saved config)
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.start).toHaveBeenLastCalledWith(expectStartOptions());
		expect(wrapper.vm.state.started).toBe(true);
	});

	it('does not restart the feed when the app resumes without having been backgrounded', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		//an isActive:true event with no preceding inactive event (e.g. cold start)
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.stop).not.toHaveBeenCalled();
	});

	it('restarts the feed after backgrounding even when the camera has no flash unit', async () => {
		grantPermissions({ flashModes: ['off'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		await listener({ isActive: false });
		await flushPromises();
		expect(wrapper.vm.state.started).toBe(false);

		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.started).toBe(true);
		expect(wrapper.vm.state.flashSupported).toBe(false);
	});

	it('dismisses the modal when the feed cannot be restarted after backgrounding', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		await listener({ isActive: false });
		await flushPromises();

		mocks.cameraPreview.start.mockRejectedValue(new Error('camera unavailable'));
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		expect(wrapper.vm.state.started).toBe(false);
	});

	it('video mode requests the microphone and starts with the audio track enabled', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		expect(mocks.cameraPreview.requestPermissions).toHaveBeenCalledWith({
			disableAudio: false,
			showSettingsAlert: true
		});
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expect.objectContaining({
			disableAudio: false,
			//Android binds the VideoCapture use case only when this is set
			enableVideoMode: true
		}));
		expect(mocks.cameraPreview.addListener).toHaveBeenCalledWith('recordingFinished', expect.any(Function));
		expect(wrapper.vm.state.started).toBe(true);
	});

	it('video mode keeps the flash toggle so the torch can light the recording', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		//the flash button is rendered in video mode (torch light while recording);
		//the flip button stays hidden
		expect(wrapper.findAll('.flash-button').length).toBe(1);
		expect(wrapper.findAll('.flip-button').length).toBe(0);

		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenCalledWith({ flashMode: 'torch' });
		expect(wrapper.vm.state.flashMode).toBe('torch');
	});

	it('photo mode never touches the video recording API', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(mocks.cameraPreview.startRecordVideo).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.stopRecordVideo).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.addListener).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.requestPermissions).toHaveBeenCalledWith({
			disableAudio: true,
			showSettingsAlert: true
		});
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expect.objectContaining({
			disableAudio: true,
			enableVideoMode: false
		}));
	});

	it('video mode dismisses the modal when the microphone permission is denied', async () => {
		grantPermissions({ camera: 'granted', microphone: 'denied' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		wrapper.unmount();
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('video mode records on the first shutter press and hands the file off on the second', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledWith({});
		expect(wrapper.vm.state.recording).toBe(true);

		await wrapper.vm.shutter();
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalled();
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.recording).toBe(false);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });

		//the handed-off file must survive unmount: video-shoot owns it now
		wrapper.unmount();
		await flushPromises();
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
	});

	it('video mode completes the hand-off when the native session stops the recording itself', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/auto.mp4' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//native auto-stop (e.g. max duration/file size): the event carries the finished
		//file path and completes the capture without calling stopRecordVideo again
		const finishedListener = mocks.cameraPreview.addListener.mock.calls.find((call) => call[0] === 'recordingFinished')[1];
		finishedListener({ videoFilePath: '/auto.mp4' });
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).not.toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/auto.mp4' });
		expect(wrapper.vm.state.recording).toBe(false);
	});

	it('video mode recovers when the recording cannot be started', async () => {
		grantPermissions();
		mocks.cameraPreview.startRecordVideo.mockRejectedValue(new Error('recording busy'));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();

		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalled();
		expect(wrapper.vm.state.recording).toBe(false);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
	});

	it('video mode discards the partial file when dismissed while recording', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/partial.mp4' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//✕ while recording: stop the recording, delete its partial file, close with no data
		await wrapper.vm.dismiss();
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalled();
		expect(mocks.cameraPreview.deleteFile).toHaveBeenCalledWith({ path: '/partial.mp4' });
		expect(wrapper.vm.state.recording).toBe(false);
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
	});

	it('video mode stops and discards the recording when unmounted by the back button', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/partial.mp4' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//the Android back button unmounts the modal without calling dismiss()
		wrapper.unmount();
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalled();
		expect(mocks.cameraPreview.deleteFile).toHaveBeenCalledWith({ path: '/partial.mp4' });
		expect(mocks.cameraPreview.stop).toHaveBeenCalled();
	});

	it('video mode sweeps stale plugin recordings before starting a session', async () => {
		grantPermissions();
		mocks.filesystem.readdir.mockResolvedValue({
			files: [{ name: 'video_1.mp4' }, { name: 'not-a-recording.jpg' }]
		});
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		expect(mocks.filesystem.readdir).toHaveBeenCalledWith({
			path: 'Movies/CameraPreview',
			directory: 'EXTERNAL'
		});
		expect(mocks.filesystem.deleteFile).toHaveBeenCalledWith({
			path: 'Movies/CameraPreview/video_1.mp4',
			directory: 'EXTERNAL'
		});
		//only mp4 recordings are swept, never other files in the directory
		expect(mocks.filesystem.deleteFile).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.start).toHaveBeenCalled();
	});

	it('photo mode never sweeps the plugin recording cache', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(mocks.filesystem.readdir).not.toHaveBeenCalled();
		expect(mocks.filesystem.deleteFile).not.toHaveBeenCalled();
	});

	it('video mode finalizes and hands off the recording when backgrounded mid-recording', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/bg.mp4' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();

		//screen off: the recording is finalized and handed to video-shoot
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/bg.mp4' });
	});

	it('video mode recovers when the native session already stopped the recording before backgrounding', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//screen off while the native side already paused/stopped the session
		mocks.cameraPreview.stopRecordVideo.mockRejectedValue(new Error('Camera is not running'));
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		//no file to hand off: the camera is released, the modal stays up, and the
		//feed restarts on return (the recording is lost, the modal is not stuck)
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.started).toBe(false);

		await listener({ isActive: true });
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.started).toBe(true);
	});

	it('exposes the flash state through computedScope instead of inline template logic', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//off by default: no active class, outline icon
		expect(wrapper.vm.isFlashActive).toBe(false);
		expect(wrapper.vm.flashIcon).toBe(wrapper.vm.flashOutline);

		await wrapper.vm.toggleFlash();
		expect(wrapper.vm.state.flashMode).toBe('torch');
		expect(wrapper.vm.isFlashActive).toBe(true);
		expect(wrapper.vm.flashIcon).toBe(wrapper.vm.flash);

		await wrapper.vm.toggleFlash();
		expect(wrapper.vm.isFlashActive).toBe(false);
		expect(wrapper.vm.flashIcon).toBe(wrapper.vm.flashOutline);
	});

	it('skips the stale-recording sweep when the platform is not Android', async () => {
		platformMock.platform = 'ios';
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		expect(mocks.filesystem.readdir).not.toHaveBeenCalled();
		expect(mocks.filesystem.deleteFile).not.toHaveBeenCalled();
		//the camera itself still starts: only the Android-only sweep is skipped
		expect(mocks.cameraPreview.start).toHaveBeenCalled();
		wrapper.unmount();
		await flushPromises();
	});

	it('removes listeners registered after unmount instead of leaking them', async () => {
		grantPermissions();
		//defer both registrations so unmount wins the race
		let resolveRecording = null;
		let resolveAppState = null;
		const recordingRemove = vi.fn();
		const appStateRemove = vi.fn();
		mocks.cameraPreview.addListener.mockReturnValue(new Promise((resolve) => {
			resolveRecording = resolve;
		}));
		mocks.capacitorApp.addListener.mockReturnValue(new Promise((resolve) => {
			resolveAppState = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		//unmount while both addListener promises are still pending
		wrapper.unmount();
		resolveRecording({ remove: recordingRemove });
		resolveAppState({ remove: appStateRemove });
		await flushPromises();

		expect(recordingRemove).toHaveBeenCalled();
		expect(appStateRemove).toHaveBeenCalled();
	});
});
