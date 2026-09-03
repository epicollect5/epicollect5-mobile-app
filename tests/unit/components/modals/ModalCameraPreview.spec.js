import ModalCameraPreview from '@/components/modals/ModalCameraPreview.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import flushPromises from 'flush-promises';

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
		setPreviewSize: vi.fn()
	};
	const capacitorApp = {
		addListener: vi.fn()
	};
	const modalController = {
		dismiss: vi.fn()
	};
	return { cameraPreview, capacitorApp, modalController };
});

vi.mock('@capgo/camera-preview', () => ({
	CameraPreview: mocks.cameraPreview
}));

vi.mock('@capacitor/app', () => ({
	App: mocks.capacitorApp
}));

vi.mock('@ionic/vue', () => ({
	modalController: mocks.modalController
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

function grantPermissions({ camera = 'granted', flashModes = ['off', 'on', 'auto', 'torch'] } = {}) {
	mocks.cameraPreview.requestPermissions.mockResolvedValue({ camera });
	mocks.cameraPreview.start.mockResolvedValue();
	mocks.cameraPreview.stop.mockResolvedValue();
	mocks.cameraPreview.capture.mockRejectedValue(new Error('not capturing in this test'));
	mocks.cameraPreview.deleteFile.mockResolvedValue({ success: true });
	mocks.cameraPreview.flip.mockResolvedValue();
	mocks.cameraPreview.getSupportedFlashModes.mockResolvedValue({ result: flashModes });
	mocks.cameraPreview.getFlashMode.mockResolvedValue({ flashMode: 'off' });
	mocks.cameraPreview.setFlashMode.mockResolvedValue();
	mocks.cameraPreview.setPreviewSize.mockResolvedValue();
	mocks.capacitorApp.addListener.mockResolvedValue({ remove: vi.fn() });
}

describe('ModalCameraPreview component', () => {

	beforeEach(() => {
		vi.clearAllMocks();
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
});
