import { describe, beforeEach, it, expect, vi } from 'vitest';
import { videoShoot } from '@/use/questions/video-shoot';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';

const nMock = vi.hoisted(() => ({
    showProgressDialog: vi.fn().mockResolvedValue(),
    hideProgressDialog: vi.fn().mockResolvedValue(),
    startForegroundService: vi.fn().mockResolvedValue('open_settings'),
    stopForegroundService: vi.fn().mockResolvedValue(),
    showAlert: vi.fn(),
    showToast: vi.fn(),
    setProgressEncoding: vi.fn()
}));

const utilsMock = vi.hoisted(() => ({
    generateMediaFilename: vi.fn().mockReturnValue('video_gen.mp4'),
    generateTimestamp: vi.fn().mockReturnValue('123')
}));

const videoEditorMock = vi.hoisted(() => ({
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    edit: vi.fn().mockResolvedValue({ file: { path: '/encoded.mp4' } })
}));

const moveFileServiceMock = vi.hoisted(() => ({
    moveToAppTemporaryDir: vi.fn().mockResolvedValue()
}));

const cameraPreviewMock = vi.hoisted(() => ({
    deleteFile: vi.fn().mockResolvedValue({ success: true })
}));

//the in-app camera branch needs to control what the modal hands back on dismiss
const modalMock = vi.hoisted(() => {
    const modal = {
        present: vi.fn().mockResolvedValue(),
        onDidDismiss: vi.fn().mockResolvedValue({ data: null })
    };
    return {
        modal,
        create: vi.fn().mockResolvedValue(modal),
        dismiss: vi.fn().mockResolvedValue()
    };
});

vi.mock('@/stores/root-store', () => ({ useRootStore: vi.fn() }));
vi.mock('@/config', () => ({ PARAMETERS: { ANDROID: 'android', IOS: 'ios', WEB: 'web', QUESTION_TYPES: { VIDEO: 'video' }, DELAY_LONG: 2000 } }));
vi.mock('@/config/strings', () => ({ STRINGS: { en: { labels: {} } } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: vi.fn((s) => s) } }));
vi.mock('@/services/notification-service', () => ({ notificationService: nMock }));
vi.mock('@/services/utilities/utils-service', () => ({ utilsService: utilsMock }));
vi.mock('@/services/filesystem/move-file-service', () => ({ moveFileService: moveFileServiceMock }));
vi.mock('@capgo/camera-preview', () => ({ CameraPreview: cameraPreviewMock }));
vi.mock('@whiteguru/capacitor-plugin-video-editor', () => ({ VideoEditor: videoEditorMock }));
vi.mock('@/components/modals/ModalProgressEncoding', () => ({ default: {} }));
vi.mock('@/components/modals/ModalCameraPreview', () => ({ default: {} }));
vi.mock('@ionic/vue', () => ({ modalController: modalMock }));

function setupRootStore(platform = PARAMETERS.ANDROID, { inAppCameraVideo = false } = {}) {
    useRootStore.mockReturnValue({
        device: { platform },
        language: 'en',
        tempDir: '',
        inAppCameraVideo,
        isVideoEncodingModalActive: false,
        isCameraPreviewModalActive: false,
        progressEncoding: { done: 0 }
    });
}

function makeArgs() {
    const entryUuid = 'entry1';
    const ref = 'q1';
    const media = { [entryUuid]: { [ref]: { cached: '', stored: '' } } };
    const state = { answer: { answer: '' }, inputDetails: { ref }, fileSource: '' };
    return { media, entryUuid, state, filename: '' };
}

describe('videoShoot tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete global.cordova;
        //do not delete global.window: jsdom's window must stay available (e.g. for
        //window.setTimeout in the transcode pipeline); tests that need a stubbed
        //window simply overwrite the (writable) jsdom window
    });

    //drive the granted + capture path and hand back the captureVideo error callback
    function grantAndCapture() {
        const GRANTED = 'GRANTED';
        let captureErr;
        global.cordova = {
            plugins: {
                diagnostic: {
                    requestRuntimePermission: vi.fn((success) => {
                        success(GRANTED);
                    }),
                    permissionStatus: { GRANTED },
                    permission: { CAMERA: 'camera' }
                }
            }
        };
        global.window = {
            navigator: {
                device: {
                    capture: {
                        captureVideo: vi.fn((success, error) => {
                            captureErr = error;
                        })
                    }
                }
            }
        };
        return () => captureErr;
    }

    it('does not persist a phantom video filename when the user opens settings', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        expect(nMock.hideProgressDialog).toHaveBeenCalledWith(0);
        expect(state.answer.answer).toBe('');
        expect(media[entryUuid]['q1'].cached).toBe('');
    });

    it('does not persist a phantom video filename when the user taps learn more', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('learn_more');
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        expect(state.answer.answer).toBe('');
        expect(media[entryUuid]['q1'].cached).toBe('');
    });

    it('clears media when the user cancels a fresh video capture', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('granted');
        const getCaptureErr = grantAndCapture();
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });
        //user cancels inside the native video capture UI (Camera plugin code 3)
        getCaptureErr()({ code: 3 });

        expect(media[entryUuid]['q1'].cached).toBe('');
        expect(state.answer.answer).toBe('');
    });

    it('preserves an existing video when the user cancels the capture', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('granted');
        const getCaptureErr = grantAndCapture();
        const { media, entryUuid, state, filename } = makeArgs();
        media[entryUuid]['q1'].cached = 'existing.mp4';
        media[entryUuid]['q1'].stored = 'existing.mp4';
        state.answer.answer = 'existing.mp4';

        await videoShoot({ media, entryUuid, state, filename });
        getCaptureErr()({ code: 3 });

        expect(media[entryUuid]['q1'].cached).toBe('existing.mp4');
        expect(state.answer.answer).toBe('existing.mp4');
    });

    it('falls back to the system camera when the in-app video flag is off', async () => {
        setupRootStore(PARAMETERS.ANDROID, { inAppCameraVideo: false });
        nMock.startForegroundService.mockResolvedValue('granted');
        grantAndCapture();
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        expect(nMock.startForegroundService).toHaveBeenCalled();
        expect(global.window.navigator.device.capture.captureVideo).toHaveBeenCalled();
        expect(modalMock.create).not.toHaveBeenCalled();
    });

    it('uses the system camera on iOS even when the in-app video flag is on', async () => {
        setupRootStore(PARAMETERS.IOS, { inAppCameraVideo: true });
        global.window = {
            cordova: {
                plugins: {
                    diagnostic: {
                        isCameraAuthorized: vi.fn((success) => success())
                    }
                }
            },
            navigator: {
                device: {
                    capture: {
                        captureVideo: vi.fn()
                    }
                }
            }
        };
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        expect(global.window.navigator.device.capture.captureVideo).toHaveBeenCalled();
        expect(modalMock.create).not.toHaveBeenCalled();
        expect(nMock.startForegroundService).not.toHaveBeenCalled();
    });

    it('records through the in-app camera when the flag is on, with no foreground service', async () => {
        setupRootStore(PARAMETERS.ANDROID, { inAppCameraVideo: true });
        modalMock.modal.onDidDismiss.mockResolvedValue({ data: { videoFilePath: '/rec.mp4' } });
        //the transcode pipeline schedules a progress reset via window.setTimeout; the
        //previous test stubbed global.window without one, so provide a minimal window
        global.window = { setTimeout: vi.fn() };
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        //the embedded camera modal is presented in video mode instead of the system camera
        expect(modalMock.create).toHaveBeenCalledWith(expect.objectContaining({
            cssClass: 'modal-camera-preview',
            componentProps: { mode: 'video' }
        }));
        expect(global.cordova).toBeUndefined();
        expect(nMock.startForegroundService).not.toHaveBeenCalled();
        expect(nMock.stopForegroundService).not.toHaveBeenCalled();

        //the captured file goes through the same transcode + move + persist pipeline
        expect(videoEditorMock.edit).toHaveBeenCalledWith(expect.objectContaining({ path: '/rec.mp4' }));
        expect(moveFileServiceMock.moveToAppTemporaryDir).toHaveBeenCalledWith('/encoded.mp4', 'video_gen.mp4');
        expect(media[entryUuid]['q1'].cached).toBe('video_gen.mp4');
        expect(state.answer.answer).toBe('video_gen.mp4');
        expect(modalMock.dismiss).toHaveBeenCalled();
        //the raw plugin recording is discarded after the transcode, so the plugin
        //cache does not accumulate one file per recording
        expect(cameraPreviewMock.deleteFile).toHaveBeenCalledWith({ path: '/rec.mp4' });
    });

    it('resets the video references when the in-app camera is dismissed without recording', async () => {
        setupRootStore(PARAMETERS.ANDROID, { inAppCameraVideo: true });
        modalMock.modal.onDidDismiss.mockResolvedValue({ data: null });
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });

        expect(modalMock.create).toHaveBeenCalledWith(expect.objectContaining({
            componentProps: { mode: 'video' }
        }));
        expect(nMock.startForegroundService).not.toHaveBeenCalled();
        expect(videoEditorMock.edit).not.toHaveBeenCalled();
        expect(media[entryUuid]['q1'].cached).toBe('');
        expect(state.answer.answer).toBe('');
    });

    it('preserves the existing video when the in-app camera is dismissed without recording', async () => {
        setupRootStore(PARAMETERS.ANDROID, { inAppCameraVideo: true });
        modalMock.modal.onDidDismiss.mockResolvedValue({ data: null });
        const { media, entryUuid, state, filename } = makeArgs();
        media[entryUuid]['q1'].cached = 'existing.mp4';
        media[entryUuid]['q1'].stored = 'existing.mp4';
        state.answer.answer = 'existing.mp4';

        await videoShoot({ media, entryUuid, state, filename });

        expect(videoEditorMock.edit).not.toHaveBeenCalled();
        expect(media[entryUuid]['q1'].cached).toBe('existing.mp4');
        expect(state.answer.answer).toBe('existing.mp4');
    });
});