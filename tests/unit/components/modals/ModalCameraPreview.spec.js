import ModalCameraPreview from '@/components/modals/ModalCameraPreview.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import flushPromises from 'flush-promises';

const platformMock = vi.hoisted(() => ({ platform: 'android' }));
const storeMock = vi.hoisted(() => ({ geolocationPermission: undefined }));

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
		getSafeAreaInsets: vi.fn(),
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
		dismiss: vi.fn(),
		getTop: vi.fn()
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

const geolocationMock = vi.hoisted(() => ({
	checkPermissions: vi.fn(),
	requestPermissions: vi.fn()
}));

vi.mock('@capacitor/geolocation', () => ({
	Geolocation: geolocationMock
}));

vi.mock('@ionic/vue', () => ({
	modalController: mocks.modalController
}));

const rollbarMock = vi.hoisted(() => ({ critical: vi.fn(), criticalWithContext: vi.fn() }));

vi.mock('@/services/utilities/rollbar-service', () => ({
	rollbarService: rollbarMock
}));

const notificationMock = vi.hoisted(() => ({ showAlert: vi.fn(async () => {}) }));

vi.mock('@/services/notification-service', () => ({
	notificationService: notificationMock
}));

vi.mock('@/stores/root-store', () => ({
	useRootStore: () => ({ device: { platform: platformMock.platform }, language: 'en', geolocationPermission: storeMock.geolocationPermission })
}));

vi.mock('@/config', () => ({
	PARAMETERS: { ANDROID: 'android' }
}));

const expectStartOptions = (height = window.innerHeight) =>
	expect.objectContaining({
		toBack: true,
		storeToFile: true,
		//the feed fills the WebView rect between the system bars (cover crops the
		//stream sides; the plugin rejects aspectRatio with explicit width/height).
		//The height is reduced by the status-bar inset (0 here) so the native layer
		//leaves that strip to the purple edge-to-edge overlay
		x: 0,
		y: 0,
		width: window.innerWidth,
		height,
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
	mocks.cameraPreview.getSafeAreaInsets.mockResolvedValue({ top: 0, orientation: 1 });
	mocks.cameraPreview.startRecordVideo.mockResolvedValue();
	mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/rec.mp4' });
	mocks.cameraPreview.addListener.mockResolvedValue({ remove: vi.fn() });
	mocks.capacitorApp.addListener.mockResolvedValue({ remove: vi.fn() });
	mocks.modalController.getTop.mockResolvedValue(null);
	mocks.filesystem.readdir.mockResolvedValue({ files: [] });
	mocks.filesystem.deleteFile.mockResolvedValue();
	//default: OS location state unreadable → legacy GPS-first attempt path
	//(every pre-existing test exercises this; prompt/grant/deny tests override)
	geolocationMock.checkPermissions.mockRejectedValue(new Error('no bridge'));
	geolocationMock.requestPermissions.mockResolvedValue({ location: 'denied' });
}

describe('ModalCameraPreview component', () => {

	//the shutter drops stop taps within ~1s of the recording start (double-tap
	//debounce): tests performing a deliberate stop jump the clock so the tap
	//lands on an old enough recording. Restored in afterEach
	let dateNowSpy = null;
	function ageRecording() {
		dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		platformMock.platform = 'android';
		storeMock.geolocationPermission = undefined;
		document.documentElement.classList.remove('camera-preview-open');
		document.body.classList.remove('camera-preview-open');
	});

	afterEach(() => {
		//the capture feedback timer must not leak across tests
		vi.clearAllTimers();
		//nor may the aged recording clock
		if (dateNowSpy) {
			dateNowSpy.mockRestore();
			dateNowSpy = null;
		}
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
		//the native layer sits in front of the edge-to-edge status-bar overlay, so
		//its height leaves that strip out: no fullscreen setPreviewSize afterwards
		//(its x=0/y=0 path skips the plugin inset and would cover the purple strip
		//with the feed again)
		expect(mocks.cameraPreview.getSafeAreaInsets).toHaveBeenCalled();

		wrapper.unmount();
		expect(document.documentElement.classList.contains('camera-preview-open')).toBe(false);
		expect(document.body.classList.contains('camera-preview-open')).toBe(false);
	});

	it('shrinks the native layer by the status-bar inset so the strip stays purple', async () => {
		grantPermissions();
		//fractional dp rounds up: rounding must err toward purple-over-feed
		mocks.cameraPreview.getSafeAreaInsets.mockResolvedValue({ top: 48.4, orientation: 1 });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expectStartOptions(window.innerHeight - 49));
		expect(wrapper.vm.state.started).toBe(true);
		wrapper.unmount();
		await flushPromises();
	});

	it('falls back to full height when the inset read fails', async () => {
		grantPermissions();
		mocks.cameraPreview.getSafeAreaInsets.mockRejectedValue(new Error('no insets'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//best-effort: without the inset the feed may cover the status strip on
		//edge-to-edge devices, but the camera itself must still be usable
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expectStartOptions());
		expect(wrapper.vm.state.started).toBe(true);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
		wrapper.unmount();
		await flushPromises();
	});

	it('skips the inset read when the platform is not Android', async () => {
		platformMock.platform = 'ios';
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//no status strip to avoid off Android: full-height layer, no bridge read
		expect(mocks.cameraPreview.getSafeAreaInsets).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expectStartOptions());
		wrapper.unmount();
		await flushPromises();
	});

	it('ignores a malformed inset payload instead of mis-sizing the layer', async () => {
		grantPermissions();
		mocks.cameraPreview.getSafeAreaInsets.mockResolvedValue({ orientation: 1 });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//non-numeric top is treated as no inset: full-height layer, camera usable
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expectStartOptions());
		expect(wrapper.vm.state.started).toBe(true);
		wrapper.unmount();
		await flushPromises();
	});

	it('reads the inset once and reuses the geometry on foreground restarts', async () => {
		grantPermissions();
		mocks.cameraPreview.getSafeAreaInsets.mockResolvedValue({ top: 48, orientation: 1 });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);

		//background/foreground: the restart reuses the built startOptions instead
		//of re-reading the inset (no resize/reposition mid-session)
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.getSafeAreaInsets).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.start).toHaveBeenLastCalledWith(expectStartOptions(window.innerHeight - 48));
		expect(wrapper.vm.state.started).toBe(true);
		wrapper.unmount();
		await flushPromises();
	});

	it('releases the session when torn down while the inset read is pending', async () => {
		grantPermissions();
		//hold the inset read open so unmount wins the race
		let resolveInsets = null;
		mocks.cameraPreview.getSafeAreaInsets.mockReturnValue(new Promise((resolve) => {
			resolveInsets = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();

		//dismiss-while-starting: the pending read must not start a session on the
		//dead modal once it resolves
		wrapper.unmount();
		resolveInsets({ top: 48, orientation: 1 });
		await flushPromises();

		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.stop).toHaveBeenCalled();
		await flushPromises();
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

	it('dismisses the modal when the camera cannot be started', async () => {
		grantPermissions();
		mocks.cameraPreview.start.mockRejectedValue(new Error('camera in use'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//dismissal is requested; the underlying app UI stays hidden until the modal
		//content is actually unmounted (mock dismiss does not unmount, so do it manually)
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		//a dead-on-arrival camera session is tracked as critical
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview.start failed', expect.any(Error));
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

	it('flips to the front camera and hides the flash toggle deterministically', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		expect(wrapper.vm.state.cameraPosition).toBe('rear');
		expect(wrapper.vm.state.flashSupported).toBe(true);

		//the native switch may settle after flip() resolves, so a bridge read
		//issued now can still report the pre-flip camera: the front side hides
		//the toggle without asking the bridge
		mocks.cameraPreview.getSupportedFlashModes.mockClear();
		await wrapper.vm.flip();

		expect(mocks.cameraPreview.flip).toHaveBeenCalled();
		expect(wrapper.vm.state.cameraPosition).toBe('front');
		expect(mocks.cameraPreview.getSupportedFlashModes).not.toHaveBeenCalled();
		expect(wrapper.vm.state.flashSupported).toBe(false);
		expect(wrapper.vm.state.torchSupported).toBe(false);
		expect(wrapper.vm.state.flashMode).toBe('off');

		//flipping back to the rear camera re-syncs its flash support from the bridge
		mocks.cameraPreview.getSupportedFlashModes.mockResolvedValue({ result: ['off', 'on', 'auto', 'torch'] });
		await wrapper.vm.flip();

		expect(wrapper.vm.state.cameraPosition).toBe('rear');
		expect(mocks.cameraPreview.getSupportedFlashModes).toHaveBeenCalledTimes(1);
		expect(wrapper.vm.state.flashSupported).toBe(true);
	});

	it('ignores a flip tapped while another flip is still in flight', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//first flip parked mid-flight on the native bridge
		let resolveFlip;
		mocks.cameraPreview.flip.mockReturnValueOnce(
			new Promise((resolve) => { resolveFlip = resolve; })
		);
		const firstFlip = wrapper.vm.flip();
		await flushPromises();
		//second tap lands while the first is still switching: dropped, not queued
		await wrapper.vm.flip();
		expect(mocks.cameraPreview.flip).toHaveBeenCalledTimes(1);

		resolveFlip();
		await firstFlip;
		await flushPromises();
		expect(wrapper.vm.state.cameraPosition).toBe('front');
		expect(wrapper.vm.state.flashSupported).toBe(false);

		//the guard resets once settled: the next tap flips back to the rear camera
		await wrapper.vm.flip();
		expect(wrapper.vm.state.cameraPosition).toBe('rear');
		expect(wrapper.vm.state.flashSupported).toBe(true);
	});

	it('ignores a flash toggle tapped while another toggle is still in flight', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//first toggle parked mid-flight on the native bridge
		let resolveToggle;
		mocks.cameraPreview.setFlashMode.mockReturnValueOnce(
			new Promise((resolve) => { resolveToggle = resolve; })
		);
		const firstToggle = wrapper.vm.toggleFlash();
		await flushPromises();
		//second tap lands while the first is still switching: dropped, not queued
		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenCalledTimes(1);

		resolveToggle();
		await firstToggle;
		await flushPromises();
		expect(wrapper.vm.state.flashMode).toBe('torch');

		//the guard resets once settled: the next tap switches the flash back off
		await wrapper.vm.toggleFlash();
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.setFlashMode).toHaveBeenLastCalledWith({ flashMode: 'off' });
		expect(wrapper.vm.state.flashMode).toBe('off');
	});

	it('ignores a stale rear-camera flash read that lands after a front flip during restart', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		expect(wrapper.vm.state.flashSupported).toBe(true);

		//foreground restart issues a rear-camera sync whose bridge read lands late
		let resolveStale;
		mocks.cameraPreview.getSupportedFlashModes.mockReturnValueOnce(
			new Promise((resolve) => { resolveStale = resolve; })
		);
		await listener({ isActive: false });
		await flushPromises();
		const foreground = listener({ isActive: true });
		await flushPromises();
		//restart parked at the deferred bridge read; the camera is up on the rear side
		expect(wrapper.vm.state.started).toBe(true);

		//the user flips to the front camera before the rear read lands
		await wrapper.vm.flip();
		expect(wrapper.vm.state.cameraPosition).toBe('front');
		expect(wrapper.vm.state.flashSupported).toBe(false);

		//the stale rear-camera response arrives with flash support...
		resolveStale({ result: ['off', 'on', 'auto', 'torch'] });
		await foreground;
		await flushPromises();
		//...and must not resurrect the flash toggle on the front camera
		expect(wrapper.vm.state.flashSupported).toBe(false);
		expect(wrapper.vm.state.torchSupported).toBe(false);
	});

	it('ignores an older flash read when a restart sync supersedes it', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		//flip to the front camera, then back to the rear with a late bridge read
		await wrapper.vm.flip();
		let resolveStale;
		mocks.cameraPreview.getSupportedFlashModes.mockReturnValueOnce(
			new Promise((resolve) => { resolveStale = resolve; })
		);
		const rearFlip = wrapper.vm.flip();
		await flushPromises();
		expect(wrapper.vm.state.cameraPosition).toBe('rear');

		//background/foreground runs a newer sync that reports no flash support
		mocks.cameraPreview.getSupportedFlashModes.mockResolvedValue({ result: ['off'] });
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.flashSupported).toBe(false);

		//the older rear read lands last with flash support and must be ignored
		resolveStale({ result: ['off', 'on', 'auto', 'torch'] });
		await rearFlip;
		await flushPromises();
		expect(wrapper.vm.state.flashSupported).toBe(false);
		expect(wrapper.vm.state.torchSupported).toBe(false);
	});

	it('restarts the flipped side after backgrounding instead of reverting to rear', async () => {
		grantPermissions({ flashModes: ['off', 'on', 'auto', 'torch'] });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.flip();
		expect(wrapper.vm.state.cameraPosition).toBe('front');

		mocks.cameraPreview.start.mockClear();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.start).toHaveBeenCalledWith(expect.objectContaining({ position: 'front' }));
		expect(wrapper.vm.state.cameraPosition).toBe('front');
	});

	it('captures a photo, stops the camera and hands the file to the caller', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).toHaveBeenCalledWith({
			//capture large and downscale once downstream (native parity): the
			//box only bounds the output, the sensor pipeline stays full-res
			width: 2048,
			height: 1536,
			quality: 90,
			format: 'jpeg',
			//GPS lands in the source EXIF; the resize step copies it over.
			//photoQualityPrioritization stays out: iOS-only, no-op on Android
			withExifLocation: true
		});
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.started).toBe(false);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });

		//unmounting the modal (which is what happens when photo-take resumes and resizes
		//the photo) must not delete the handed-off file: photo-take owns it now
		wrapper.unmount();
		await flushPromises();
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
	});

	it('retries without GPS when location denial rejects the capture', async () => {
		grantPermissions();
		//the plugin fails closed on location denial: first attempt rejects
		mocks.cameraPreview.capture.mockRejectedValueOnce(new Error('Location permission denied'));
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		//exactly one retry, GPS flag off: the photo still captures, only EXIF GPS is skipped
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBe(true);
		expect(mocks.cameraPreview.capture.mock.calls[1][0].withExifLocation).toBeUndefined();
		expect(mocks.cameraPreview.capture.mock.calls[1][0]).toEqual(expect.objectContaining({
			width: 2048,
			height: 1536,
			quality: 90,
			format: 'jpeg'
		}));
		//the hand-off flags the GPS fallback so photo-take strips GPS tags downstream
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: true });
		expect(wrapper.vm.state.started).toBe(false);
	});

	it('does not retry a non-location capture failure', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockRejectedValue(new Error('camera busy'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
		expect(wrapper.vm.state.capturing).toBe(false);
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
		//the user is told the capture failed instead of seeing a reset shutter
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview capture failed', expect.any(Error));
		expect(notificationMock.showAlert).toHaveBeenCalled();
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

	it('yields dismissal to an in-flight photo handoff instead of racing it', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		//hold the handoff stop open so the ✕ tap lands mid-handoff
		let resolveStop = null;
		mocks.cameraPreview.stop.mockReturnValue(new Promise((resolve) => {
			resolveStop = resolve;
		}));
		const overlay = {};
		mocks.modalController.getTop.mockResolvedValue(overlay);
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		//capture resolves, handoff claims the dismissal: close held, back held
		const capturePromise = wrapper.vm.capture();
		await flushPromises();
		expect(wrapper.vm.state.handoff).toBe(true);
		expect(overlay.canDismiss).toBe(false);

		//✕ during handoff: swallowed, no empty dismiss steals the file
		await wrapper.vm.dismiss();
		await flushPromises();
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();

		//stop settles: single payload dismiss, exit restored, file kept
		resolveStop();
		await capturePromise;
		await flushPromises();
		expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
		expect(overlay.canDismiss).toBe(true);
		expect(wrapper.vm.state.handoff).toBe(false);
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();

		wrapper.unmount();
		await flushPromises();
	});

	it('waits for an in-flight photo handoff on unmount instead of dropping it', async () => {
		vi.useFakeTimers();
		try {
			grantPermissions();
			mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
			let resolveStop = null;
			mocks.cameraPreview.stop.mockReturnValue(new Promise((resolve) => {
				resolveStop = resolve;
			}));
			const wrapper = shallowMount(ModalCameraPreview);
			await flushPromises();

			const capturePromise = wrapper.vm.capture();
			await flushPromises();
			expect(wrapper.vm.state.handoff).toBe(true);

			//back button while the handoff stop is parked: unmount waits (frozen
			//clock, so the 1.5s fallback cannot fire), no empty dismiss
			wrapper.unmount();
			await flushPromises();
			expect(mocks.modalController.dismiss).not.toHaveBeenCalled();

			resolveStop();
			await capturePromise;
			await flushPromises();
			expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);
			expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
			expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('reopens the exit when a handoff stalls past the escape timeout', async () => {
		vi.useFakeTimers();
		try {
			grantPermissions();
			mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
			let resolveStop = null;
			mocks.cameraPreview.stop.mockReturnValue(new Promise((resolve) => {
				resolveStop = resolve;
			}));
			const wrapper = shallowMount(ModalCameraPreview);
			await flushPromises();

			const capturePromise = wrapper.vm.capture();
			await flushPromises();
			expect(wrapper.vm.state.handoff).toBe(true);

			//stall past the escape hatch: the exit (bound to the same flag the
			//dismiss guard reads) reopens and the stall is reported
			await vi.advanceTimersByTimeAsync(3000);
			expect(wrapper.vm.state.handoff).toBe(false);
			expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith(
				'CameraPreview handoff stalled',
				expect.any(Error)
			);

			//the handoff itself is unbroken by the escape: resolving the stop
			//still delivers the payload dismiss exactly once
			resolveStop();
			await capturePromise;
			await flushPromises();
			expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);
			expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
			wrapper.unmount();
			await flushPromises();
		} finally {
			vi.useRealTimers();
		}
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
		//losing the session on restart is tracked as critical
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview restart failed', expect.any(Error));
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
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();

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

	it('blocks dismissal while recording so the back button is ignored, and restores it on stop', async () => {
		grantPermissions();
		const overlay = {};
		mocks.modalController.getTop.mockResolvedValue(overlay);
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();
		//Ionic consults canDismiss for hardware-back dismissal too: false keeps
		//the modal (and the recording) alive on back presses
		expect(overlay.canDismiss).toBe(false);

		//second shutter press stops the recording and hands the file off
		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(false);
		//restored before the programmatic dismiss below (dismiss is gated too)
		expect(overlay.canDismiss).toBe(true);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });
	});

	it('restores dismissal when the modal is closed while recording', async () => {
		grantPermissions();
		const overlay = {};
		mocks.modalController.getTop.mockResolvedValue(overlay);
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(overlay.canDismiss).toBe(false);

		//✕ while recording: the partial file is discarded and dismissal restored
		await wrapper.vm.dismiss();
		await flushPromises();
		expect(overlay.canDismiss).toBe(true);
		expect(mocks.modalController.dismiss).toHaveBeenCalled();
		expect(mocks.cameraPreview.deleteFile).toHaveBeenCalled();
	});

	it('holds dismissal through the video handoff and restores it after the stop', async () => {
		grantPermissions();
		//hold the handoff stop open so the ✕ tap lands mid-handoff
		let resolveStop = null;
		mocks.cameraPreview.stop.mockReturnValue(new Promise((resolve) => {
			resolveStop = resolve;
		}));
		const overlay = {};
		mocks.modalController.getTop.mockResolvedValue(overlay);
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		//record, then stop: finalize hands off with the stop parked
		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();
		const stopPress = wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.handoff).toBe(true);
		//restore moved post-stop: back stays held through the handoff, not just the recording
		expect(overlay.canDismiss).toBe(false);

		//✕ during handoff: swallowed, no empty dismiss steals the file
		await wrapper.vm.dismiss();
		await flushPromises();
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();

		resolveStop();
		await stopPress;
		await flushPromises();
		expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });
		expect(overlay.canDismiss).toBe(true);
		expect(wrapper.vm.state.handoff).toBe(false);
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();

		wrapper.unmount();
		await flushPromises();
	});

	it('keeps recording when the overlay cannot be resolved', async () => {
		grantPermissions();
		mocks.modalController.getTop.mockResolvedValue(null);
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		//no overlay to mutate: the recording still starts, nothing throws
		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(false);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });
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
		//the user is told the recording failed to start instead of seeing a reset shutter
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview startRecordVideo failed', expect.any(Error));
		expect(notificationMock.showAlert).toHaveBeenCalled();
	});

	it('video mode drops a shutter tap landing while the recording stop is still in flight', async () => {
		grantPermissions();
		//park the native stop so the second tap lands mid-stop (the double-tap race)
		let resolveStop = null;
		mocks.cameraPreview.stopRecordVideo.mockReturnValue(new Promise((resolve) => {
			resolveStop = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		expect(wrapper.vm.state.transitioning).toBe(false);
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();

		//first stop press parks on the pending native stop
		const stopPress = wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalledTimes(1);
		expect(wrapper.vm.state.transitioning).toBe(true);
		//the shutter shows the modal as busy while the stop settles
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.shutter-button').element.disabled).toBe(true);

		//second tap of the double-tap lands mid-stop: dropped, never a new start
		//against the still-active native session (mirror-mode failure)
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalledTimes(1);

		resolveStop({ videoFilePath: '/rec.mp4' });
		await stopPress;
		await flushPromises();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });
		expect(wrapper.vm.state.transitioning).toBe(false);

		//the handed-off file must survive unmount: video-shoot owns it now
		wrapper.unmount();
		await flushPromises();
		expect(mocks.cameraPreview.deleteFile).not.toHaveBeenCalled();
	});

	it('video mode drops a shutter tap landing while the recording start is still in flight', async () => {
		grantPermissions();
		//park the native start so the second tap lands mid-start
		let resolveStart = null;
		mocks.cameraPreview.startRecordVideo.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		//first tap parks on the pending native start
		const startPress = wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);
		expect(wrapper.vm.state.transitioning).toBe(true);

		//second tap of the double-tap lands mid-start: dropped, never a second start
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.stopRecordVideo).not.toHaveBeenCalled();

		resolveStart();
		await startPress;
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		expect(wrapper.vm.state.transitioning).toBe(false);

		wrapper.unmount();
		await flushPromises();
	});

	it('video mode drops a shutter tap landing during the recording handoff', async () => {
		grantPermissions();
		//hold the handoff stop open so the tap lands mid-handoff
		let resolveStop = null;
		mocks.cameraPreview.stop.mockReturnValue(new Promise((resolve) => {
			resolveStop = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();
		const stopPress = wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.handoff).toBe(true);

		//shutter tap during handoff: dropped, never a new recording
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);

		resolveStop();
		await stopPress;
		await flushPromises();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });

		wrapper.unmount();
		await flushPromises();
	});

	it('video mode drops shutter taps stacking on the start-failure alert', async () => {
		grantPermissions();
		mocks.cameraPreview.startRecordVideo.mockRejectedValue(new Error('recording busy'));
		//park the failure alert so extra taps land while it is showing
		let resolveAlert = null;
		notificationMock.showAlert.mockReturnValue(new Promise((resolve) => {
			resolveAlert = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		const firstPress = wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);
		expect(notificationMock.showAlert).toHaveBeenCalled();

		//rapid taps while the alert is up: dropped, never stacked starts
		await wrapper.vm.shutter();
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);

		resolveAlert();
		await firstPress;
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(false);
		expect(wrapper.vm.state.transitioning).toBe(false);
		expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
		//restore the shared alert mock: later tests need it to resolve
		notificationMock.showAlert.mockResolvedValue();

		wrapper.unmount();
		await flushPromises();
	});

	it('video mode ignores a stop tap landing before the recording produced data', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		const startedAt = Date.now();

		//second tap of the double-tap lands before the first key frame exists:
		//dropped, the recording keeps running instead of failing the native
		//stop with ERROR_NO_VALID_DATA
		dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(startedAt + 500);
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.stopRecordVideo).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.startRecordVideo).toHaveBeenCalledTimes(1);
		expect(wrapper.vm.state.recording).toBe(true);

		//a deliberate stop past the window finalizes normally
		dateNowSpy.mockReturnValue(startedAt + 1500);
		await wrapper.vm.shutter();
		await flushPromises();
		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalledTimes(1);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/rec.mp4' });

		wrapper.unmount();
		await flushPromises();
	});

	it('video mode still finalizes immediately when backgrounded inside the debounce window', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockResolvedValue({ videoFilePath: '/bg.mp4' });
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//screen off right after the start: the background path bypasses the
		//shutter debounce and finalizes at once instead of leaking the recording
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		expect(mocks.cameraPreview.stopRecordVideo).toHaveBeenCalledTimes(1);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ videoFilePath: '/bg.mp4' });

		wrapper.unmount();
		await flushPromises();
	});

	it('video mode alerts and dismisses when finalizing the recording fails in the foreground', async () => {
		grantPermissions();
		mocks.cameraPreview.stopRecordVideo.mockRejectedValue(new Error('stop failed'));
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);
		//a deliberate stop lands past the double-tap debounce window
		ageRecording();

		//second shutter press tries to finalize and fails: no video was captured,
		//so the user is told and the modal closes (empty dismiss = cancel,
		//the existing media is kept by the caller)
		await wrapper.vm.shutter();
		await flushPromises();

		expect(wrapper.vm.state.recording).toBe(false);
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview finalize recording failed', expect.any(Error));
		expect(notificationMock.showAlert).toHaveBeenCalled();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith();
	});

	it('video mode stays silent when finalizing fails while backgrounded', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview, { props: { mode: 'video' } });
		await flushPromises();

		await wrapper.vm.shutter();
		await flushPromises();
		expect(wrapper.vm.state.recording).toBe(true);

		//screen off while recording with a native side that cannot finalize:
		//tracked, camera released, modal stays up for feed recovery — no alert
		//over a backgrounded app and no dismiss
		mocks.cameraPreview.stopRecordVideo.mockRejectedValue(new Error('Camera is not running'));
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview finalize recording failed', expect.any(Error));
		expect(notificationMock.showAlert).not.toHaveBeenCalled();
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
		//a clean hand-off is not an error: nothing is reported
		expect(rollbarMock.criticalWithContext).not.toHaveBeenCalled();
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
		//the lost recording is tracked as critical
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview background recording lost', expect.any(Error));

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

	it('recovers when the app backgrounds while the initial startup is still pending', async () => {
		grantPermissions();
		//hold the initial startup open so the backgrounding lands mid-startup
		let resolveStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(wrapper.vm.state.started).toBe(false);

		//screen off before startup completes: still counts as backgrounded
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		//startup completes while paused: the session is stale, not live
		resolveStart();
		await flushPromises();
		expect(wrapper.vm.state.started).toBe(true);

		//foregrounding releases the stale session and restarts the feed
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.started).toBe(true);

		wrapper.unmount();
		await flushPromises();
	});

	it('defers the feed recovery when the app foregrounds before the pending start resolves', async () => {
		grantPermissions();
		//hold the initial startup open so the foreground lands mid-startup
		let resolveStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();

		//foreground while the start is still pending: recovery deferred, no second start
		await listener({ isActive: true });
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);

		//the start resolves with a possibly-paused session: deferred recovery
		//releases the stale session and restarts the feed
		resolveStart();
		await flushPromises();

		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.started).toBe(true);

		wrapper.unmount();
		await flushPromises();
	});

	it('does not recover while backgrounded again before the pending start resolves', async () => {
		grantPermissions();
		let resolveStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();
		//backgrounded again before the start lands
		await listener({ isActive: false });
		await flushPromises();

		resolveStart();
		await flushPromises();

		//still backgrounded: no restart, the stale session stays until foreground
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.stop).not.toHaveBeenCalled();

		//returning to the foreground releases the stale session and restarts
		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(wrapper.vm.state.started).toBe(true);

		wrapper.unmount();
		await flushPromises();
	});

	it('dismisses with a start error when the pending start rejects after a foreground cycle', async () => {
		grantPermissions();
		let rejectStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve, reject) => {
			rejectStart = reject;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();

		//the pending start fails: the armed flag must not trigger a recovery,
		//the mount failure path dismisses with the reason instead
		rejectStart(new Error('camera gone'));
		await flushPromises();

		expect(mocks.modalController.dismiss).toHaveBeenCalledWith(
			expect.objectContaining({ startError: 'camera gone' })
		);
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);

		wrapper.unmount();
		await flushPromises();
	});

	it('releases the native session when unmounted while startup is still pending', async () => {
		grantPermissions();
		//hold the initial startup open so the back button lands mid-startup
		let resolveStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(wrapper.vm.state.started).toBe(false);

		//back button during startup: teardown wins the race
		wrapper.unmount();
		await flushPromises();
		resolveStart();
		await flushPromises();

		//the late startup releases the session instead of marking state
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
		expect(wrapper.vm.state.started).toBe(false);
	});

	it('skips the permission prompt when torn down before startup runs', async () => {
		grantPermissions();
		//hold the permission request open so teardown lands before it resolves
		let resolvePermissions = null;
		mocks.cameraPreview.requestPermissions.mockReturnValue(new Promise((resolve) => {
			resolvePermissions = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.requestPermissions).toHaveBeenCalledTimes(1);

		//dismiss-while-backgrounded before permissions resolve: dead modal
		wrapper.unmount();
		await flushPromises();
		resolvePermissions({ camera: 'granted', microphone: 'granted' });
		await flushPromises();

		//no session is started for the dead modal; any native session is released
		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.stop).toHaveBeenCalledWith({ force: true });
	});

	it('does not restart the feed on foreground after teardown began', async () => {
		grantPermissions();
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(1);
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		//background, then teardown begins before the foreground event
		await listener({ isActive: false });
		await flushPromises();
		wrapper.unmount();
		await flushPromises();
		vi.clearAllMocks();

		await listener({ isActive: true });
		await flushPromises();

		expect(mocks.cameraPreview.requestPermissions).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();
	});

	it('swallows a rejecting native stop during the startup/teardown race', async () => {
		grantPermissions();
		mocks.cameraPreview.stop.mockRejectedValue(new Error('stop boom'));
		let resolveStart = null;
		mocks.cameraPreview.start.mockReturnValue(new Promise((resolve) => {
			resolveStart = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		wrapper.unmount();
		await flushPromises();
		resolveStart();
		await flushPromises();

		//never throws, never marks state on the destroyed modal
		expect(wrapper.vm.state.started).toBe(false);
	});

	it('retries GPS-less when the first capture hangs on the location edge', async () => {
		vi.useFakeTimers();
		try {
			grantPermissions();
			//first attempt hangs forever (unsettled bridge call on denied
			//location), second attempt delivers the photo
			mocks.cameraPreview.capture.mockReturnValueOnce(new Promise(() => {}));
			mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
			const wrapper = shallowMount(ModalCameraPreview);
			await flushPromises();

			const capturePromise = wrapper.vm.capture();
			await flushPromises();
			expect(wrapper.vm.state.capturing).toBe(true);

			//timeout fires: exactly one GPS-less retry, photo handed off
			await vi.advanceTimersByTimeAsync(6000);
			await capturePromise;
			await flushPromises();

			expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(2);
			expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBe(true);
			expect(mocks.cameraPreview.capture.mock.calls[1][0].withExifLocation).toBeUndefined();
			expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: true });
			wrapper.unmount();
			await flushPromises();
		} finally {
			vi.useRealTimers();
		}
	});

	it('alerts and re-enables the shutter when both capture attempts hang', async () => {
		vi.useFakeTimers();
		try {
			grantPermissions();
			//both attempts hang: no photo, but the modal must not brick grey
			mocks.cameraPreview.capture.mockReturnValue(new Promise(() => {}));
			const wrapper = shallowMount(ModalCameraPreview);
			await flushPromises();

			const capturePromise = wrapper.vm.capture();
			await flushPromises();

			await vi.advanceTimersByTimeAsync(12000);
			await capturePromise;
			await flushPromises();

			expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(2);
			expect(mocks.modalController.dismiss).not.toHaveBeenCalled();
			expect(wrapper.vm.state.capturing).toBe(false);
			expect(wrapper.vm.state.started).toBe(true);
			expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview capture failed', expect.any(Error));
			expect(notificationMock.showAlert).toHaveBeenCalled();
			wrapper.unmount();
			await flushPromises();
		} finally {
			vi.useRealTimers();
		}
	});

	it('still requests the GPS capture first when location was already denied', async () => {
		storeMock.geolocationPermission = false;
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		//the system location prompt must be preserved (a grant embeds GPS):
		//the first attempt always carries withExifLocation, a denial resolves
		//GPS-less natively or falls back to the retry below
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBe(true);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
		wrapper.unmount();
		await flushPromises();
	});

	it('recovers the shutter when the handoff dismiss is blocked', async () => {
		grantPermissions();
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		//payload dismiss blocked (e.g. stale canDismiss=false): must not brick grey
		mocks.modalController.dismiss.mockRejectedValueOnce(new Error('dismiss blocked'));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(mocks.modalController.dismiss).toHaveBeenCalledTimes(1);
		//the undelivered file is cleaned up, not orphaned; shutter retryable
		expect(mocks.cameraPreview.deleteFile).toHaveBeenCalledWith({ path: '/capture.jpg' });
		expect(wrapper.vm.state.capturing).toBe(false);
		expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('CameraPreview capture failed', expect.any(Error));
		expect(notificationMock.showAlert).toHaveBeenCalled();
		wrapper.unmount();
		await flushPromises();
	});

	it('defers the foreground restart while a photo capture is in flight', async () => {
		grantPermissions();
		//hold the capture open so the foreground event lands mid-capture
		let resolveCapture = null;
		mocks.cameraPreview.capture.mockReturnValue(new Promise((resolve) => {
			resolveCapture = resolve;
		}));
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		const capturePromise = wrapper.vm.capture();
		await flushPromises();

		//background stops the camera, foreground during capture defers (no restart yet)
		await listener({ isActive: false });
		await flushPromises();
		mocks.cameraPreview.start.mockClear();
		await listener({ isActive: true });
		await flushPromises();
		expect(mocks.cameraPreview.start).not.toHaveBeenCalled();

		//capture fails (camera not running after the background stop): the
		//deferred restart runs so the modal is retryable with a live feed
		resolveCapture({ value: '/capture.jpg' });
		await capturePromise;
		await flushPromises();
		wrapper.unmount();
		await flushPromises();
	});

	it('prompts for location via Geolocation and embeds GPS when granted', async () => {
		grantPermissions();
		//OS state askable: the dialog is owned by Geolocation (settles
		//reliably), the grant flows into the GPS capture
		geolocationMock.checkPermissions.mockResolvedValue({ location: 'prompt' });
		geolocationMock.requestPermissions.mockResolvedValue({ location: 'granted' });
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(geolocationMock.requestPermissions).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBe(true);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
		wrapper.unmount();
		await flushPromises();
	});

	it('goes GPS-less instantly when the location prompt is denied', async () => {
		grantPermissions();
		//denial is owned by Geolocation: single GPS-less capture, no 12s hang
		geolocationMock.checkPermissions.mockResolvedValue({ location: 'prompt' });
		geolocationMock.requestPermissions.mockResolvedValue({ location: 'denied' });
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(geolocationMock.requestPermissions).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBeUndefined();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: true });
		wrapper.unmount();
		await flushPromises();
	});

	it('goes GPS-less without prompting when location is permanently denied', async () => {
		grantPermissions();
		//the OS shows no dialog in this state: no request, instant GPS-less
		geolocationMock.checkPermissions.mockResolvedValue({ location: 'denied' });
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(geolocationMock.requestPermissions).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBeUndefined();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: true });
		wrapper.unmount();
		await flushPromises();
	});

	it('embeds GPS without re-prompting when location is already granted', async () => {
		grantPermissions();
		geolocationMock.checkPermissions.mockResolvedValue({ location: 'granted' });
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();

		await wrapper.vm.capture();
		await flushPromises();

		expect(geolocationMock.requestPermissions).not.toHaveBeenCalled();
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(1);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBe(true);
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: false });
		wrapper.unmount();
		await flushPromises();
	});

	it('restarts the feed when the permission dialog releases the camera mid-capture', async () => {
		grantPermissions();
		geolocationMock.checkPermissions.mockResolvedValue({ location: 'prompt' });
		//hold the permission dialog open so it pauses the app mid-capture
		let resolvePerm = null;
		geolocationMock.requestPermissions.mockReturnValue(new Promise((resolve) => {
			resolvePerm = resolve;
		}));
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		//user denies: the first attempt hits the session released by the
		//pause ("Camera is not running") — no alert, the feed restarts and
		//the attempts run again, delivering the photo GPS-less
		mocks.cameraPreview.capture.mockRejectedValueOnce(new Error('Camera is not running'));
		mocks.cameraPreview.capture.mockResolvedValue({ value: '/capture.jpg' });
		const wrapper = shallowMount(ModalCameraPreview);
		await flushPromises();
		const listener = mocks.capacitorApp.addListener.mock.calls[0][1];

		const capturePromise = wrapper.vm.capture();
		await flushPromises();

		//the dialog pauses/resumes the app: background releases the camera,
		//foreground defers while the capture is flagged in flight
		await listener({ isActive: false });
		await flushPromises();
		await listener({ isActive: true });
		await flushPromises();
		expect(wrapper.vm.state.started).toBe(false);

		resolvePerm({ location: 'denied' });
		await capturePromise;
		await flushPromises();

		expect(mocks.cameraPreview.start).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.capture).toHaveBeenCalledTimes(2);
		expect(mocks.cameraPreview.capture.mock.calls[0][0].withExifLocation).toBeUndefined();
		expect(mocks.modalController.dismiss).toHaveBeenCalledWith({ sourcePath: '/capture.jpg', gpsFallback: true });
		expect(notificationMock.showAlert).not.toHaveBeenCalled();
		wrapper.unmount();
		await flushPromises();
	});
});
