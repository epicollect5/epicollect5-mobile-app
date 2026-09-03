import { describe, beforeEach, it, expect, vi } from 'vitest';
import { photoTake } from '@/use/questions/photo-take';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { Camera } from '@capacitor/camera';

const nMock = vi.hoisted(() => ({
    showProgressDialog: vi.fn().mockResolvedValue(),
    hideProgressDialog: vi.fn().mockResolvedValue(),
    startForegroundService: vi.fn().mockResolvedValue('open_settings'),
    stopForegroundService: vi.fn().mockResolvedValue(),
    showAlert: vi.fn()
}));

const modalMock = vi.hoisted(() => ({
    create: vi.fn(),
    present: vi.fn(),
    onDidDismiss: vi.fn()
}));

const resizeMock = vi.hoisted(() => ({
    resizeToTempDir: vi.fn().mockResolvedValue('photo_gen.jpg')
}));

const cameraPreviewMock = vi.hoisted(() => ({
    deleteFile: vi.fn().mockResolvedValue({ success: true })
}));

const utilsMock = vi.hoisted(() => ({
    generateMediaFilename: vi.fn().mockReturnValue('photo_gen.jpg'),
    generateTimestamp: vi.fn().mockReturnValue('123')
}));

vi.mock('@/stores/root-store', () => ({ useRootStore: vi.fn() }));
vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        IOS: 'ios',
        WEB: 'web',
        QUESTION_TYPES: { PHOTO: 'photo' },
        IN_APP_CAMERA_DOCS_URL: 'https://docs.example/in-app-camera'
    }
}));
vi.mock('@/config/strings', () => ({ STRINGS: { en: { labels: { wait: 'wait' } } } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: vi.fn((s) => s) } }));
vi.mock('@capacitor/camera', () => ({ Camera: { getPhoto: vi.fn() }, CameraResultType: { Uri: 'uri' }, CameraSource: { Photos: 'photos', Camera: 'camera' } }));
vi.mock('@capgo/camera-preview', () => ({ CameraPreview: cameraPreviewMock }));
vi.mock('@ionic/vue', () => ({ modalController: modalMock }));
vi.mock('@/services/notification-service', () => ({ notificationService: nMock }));
vi.mock('@/services/utilities/utils-service', () => ({ utilsService: utilsMock }));
vi.mock('@/services/filesystem/move-file-service', () => ({ moveFileService: { moveToAppTemporaryDir: vi.fn().mockResolvedValue() } }));
vi.mock('@/services/filesystem/resize-photo-service', () => ({ resizePhotoService: resizeMock }));
vi.mock('@/components/modals/ModalCameraPreview.vue', () => ({ default: { name: 'ModalCameraPreview' } }));

function setupRootStore({ platform = PARAMETERS.ANDROID, inAppCamera = false } = {}) {
    useRootStore.mockReturnValue({
        device: { platform },
        language: 'en',
        tempDir: '/tmp/',
        inAppCamera,
        isCameraPreviewModalActive: false
    });
}

function makeArgs(action = 'camera') {
    const entryUuid = 'entry1';
    const ref = 'q1';
    const media = { [entryUuid]: { [ref]: { cached: '', stored: '' } } };
    const state = { answer: { answer: '' }, inputDetails: { ref }, imageSource: '', fileSource: '' };
    return { media, entryUuid, state, filename: '', action };
}

function setupModalPresent({ sourcePath = '/source.jpg' } = {}) {
    const dismissPromise = Promise.resolve({ data: sourcePath ? { sourcePath } : undefined });
    modalMock.create.mockResolvedValue({
        present: modalMock.present.mockResolvedValue(undefined),
        onDidDismiss: modalMock.onDidDismiss.mockReturnValue(dismissPromise)
    });
}

describe('photoTake tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not launch the camera or set an answer when the user opens settings', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename, action } = makeArgs();

        await photoTake({ media, entryUuid, state, filename, action });

        expect(Camera.getPhoto).not.toHaveBeenCalled();
        expect(modalMock.create).not.toHaveBeenCalled();
        expect(state.answer.answer).toBe('');
    });

    it('triggers the notification flow when picking from the gallery', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename } = makeArgs('gallery');

        await photoTake({ media, entryUuid, state, filename, action: 'gallery' });

        expect(nMock.startForegroundService).toHaveBeenCalled();
        expect(Camera.getPhoto).not.toHaveBeenCalled();
        expect(modalMock.create).not.toHaveBeenCalled();
    });

    it('leaves media empty when the user cancels a fresh photo capture', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('granted');
        Camera.getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
        const { media, entryUuid, state, filename, action } = makeArgs();

        await photoTake({ media, entryUuid, state, filename, action });

        expect(Camera.getPhoto).toHaveBeenCalled();
        expect(media[entryUuid]['q1'].cached).toBe('');
        expect(state.answer.answer).toBe('');
    });

    it('preserves an existing photo when the user cancels the capture', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('granted');
        Camera.getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
        const { media, entryUuid, state, filename, action } = makeArgs();
        media[entryUuid]['q1'].cached = 'existing.jpg';
        media[entryUuid]['q1'].stored = 'existing.jpg';
        state.answer.answer = 'existing.jpg';

        await photoTake({ media, entryUuid, state, filename, action });

        expect(media[entryUuid]['q1'].cached).toBe('existing.jpg');
        expect(state.answer.answer).toBe('existing.jpg');
    });

    it('opens the in-app modal on Android when inAppCamera flag is on and action is camera', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        setupModalPresent({ sourcePath: '/capture.jpg' });
        const { media, entryUuid, state, filename, action } = makeArgs('camera');

        await photoTake({ media, entryUuid, state, filename, action });

        expect(modalMock.create).toHaveBeenCalledWith(
            expect.objectContaining({
                cssClass: 'modal-camera-preview',
                //required so Ionic closes the camera via the Android back button
                backdropDismiss: true
            })
        );
        expect(Camera.getPhoto).not.toHaveBeenCalled();
        expect(nMock.startForegroundService).not.toHaveBeenCalled();		expect(resizeMock.resizeToTempDir).toHaveBeenCalledWith('/capture.jpg', 'photo_gen.jpg');
		expect(media[entryUuid]['q1'].cached).toBe('photo_gen.jpg');
		expect(state.answer.answer).toBe('photo_gen.jpg');
		expect(state.imageSource).toContain('/tmp/photo_gen.jpg');
		//the modal hands the capture over; photo-take removes it once it has been resized
		expect(cameraPreviewMock.deleteFile).toHaveBeenCalledWith({ path: '/capture.jpg' });
	});

	it('resets the answer and cleans up the capture when the in-app resize fails', async () => {
		setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
		setupModalPresent({ sourcePath: '/capture.jpg' });
		resizeMock.resizeToTempDir.mockRejectedValueOnce(new Error('resize boom'));
		const { media, entryUuid, state, filename, action } = makeArgs('camera');

		await photoTake({ media, entryUuid, state, filename, action });

		expect(resizeMock.resizeToTempDir).toHaveBeenCalledWith('/capture.jpg', 'photo_gen.jpg');
		expect(media[entryUuid]['q1'].cached).toBe('');
		expect(state.answer.answer).toBe('');
		expect(nMock.showAlert).toHaveBeenCalledWith('resize boom');
		expect(cameraPreviewMock.deleteFile).toHaveBeenCalledWith({ path: '/capture.jpg' });
	});

    it('does not open the in-app modal on iOS even when inAppCamera flag is on', async () => {
        setupRootStore({ platform: PARAMETERS.IOS, inAppCamera: true });
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename, action } = makeArgs('camera');

        await photoTake({ media, entryUuid, state, filename, action });

        expect(modalMock.create).not.toHaveBeenCalled();
        expect(nMock.startForegroundService).toHaveBeenCalled();
    });

    it('does not open the in-app modal for gallery action even when flag is on', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename } = makeArgs('gallery');

        await photoTake({ media, entryUuid, state, filename, action: 'gallery' });

        expect(modalMock.create).not.toHaveBeenCalled();
        expect(nMock.startForegroundService).toHaveBeenCalled();
    });

    it('resets media when the in-app modal is cancelled', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        setupModalPresent({ sourcePath: '' });
        const { media, entryUuid, state, filename, action } = makeArgs('camera');

        await photoTake({ media, entryUuid, state, filename, action });

        expect(modalMock.create).toHaveBeenCalled();
        expect(resizeMock.resizeToTempDir).not.toHaveBeenCalled();
        expect(media[entryUuid]['q1'].cached).toBe('');
        expect(state.answer.answer).toBe('');
    });

    it('preserves the existing photo when the in-app modal is dismissed without a capture', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        setupModalPresent({ sourcePath: '' });
        const { media, entryUuid, state, filename, action } = makeArgs('camera');
        media[entryUuid]['q1'].cached = 'existing.jpg';
        media[entryUuid]['q1'].stored = 'existing.jpg';
        state.answer.answer = 'existing.jpg';

        await photoTake({ media, entryUuid, state, filename, action });

        expect(modalMock.create).toHaveBeenCalled();
        expect(resizeMock.resizeToTempDir).not.toHaveBeenCalled();
        expect(cameraPreviewMock.deleteFile).not.toHaveBeenCalled();
        expect(media[entryUuid]['q1'].cached).toBe('existing.jpg');
        expect(state.answer.answer).toBe('existing.jpg');
    });

    it('reuses the cached filename on an in-app retake instead of generating a new file', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        setupModalPresent({ sourcePath: '/capture2.jpg' });
        const { media, entryUuid, state, filename, action } = makeArgs('camera');
        media[entryUuid]['q1'].cached = 'cached1.jpg';
        media[entryUuid]['q1'].stored = '';

        await photoTake({ media, entryUuid, state, filename, action });

        expect(utilsMock.generateMediaFilename).not.toHaveBeenCalled();
        expect(resizeMock.resizeToTempDir).toHaveBeenCalledWith('/capture2.jpg', 'cached1.jpg');
        expect(media[entryUuid]['q1'].cached).toBe('cached1.jpg');
        expect(state.answer.answer).toBe('cached1.jpg');
    });

    it('guards the EntriesAdd back handler while the camera modal is open', async () => {
        setupRootStore({ platform: PARAMETERS.ANDROID, inAppCamera: true });
        setupModalPresent({ sourcePath: '' });
        //keep the modal open until we have checked the guard flag
        let resolveDismiss = null;
        modalMock.onDidDismiss.mockReturnValue(new Promise((resolve) => {
            resolveDismiss = resolve;
        }));
        const rootStore = useRootStore();
        const { media, entryUuid, state, filename, action } = makeArgs('camera');

        const pendingPhotoTake = photoTake({ media, entryUuid, state, filename, action });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        //while the modal is presented the flag is set, so EntriesAdd ignores back
        //(Ionic's overlay handler then dismisses the camera instead of navigating)
        expect(rootStore.isCameraPreviewModalActive).toBe(true);

        resolveDismiss({ data: undefined });
        await pendingPhotoTake;

        expect(rootStore.isCameraPreviewModalActive).toBe(false);
        expect(media[entryUuid]['q1'].cached).toBe('');
    });
});
