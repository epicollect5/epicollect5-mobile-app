import { vi } from 'vitest';
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

vi.mock('@/stores/root-store', () => ({ useRootStore: vi.fn() }));
vi.mock('@/config', () => ({ PARAMETERS: { ANDROID: 'android', WEB: 'web', QUESTION_TYPES: { VIDEO: 'video' } } }));
vi.mock('@/config/strings', () => ({ STRINGS: { en: { labels: {} } } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: vi.fn((s) => s) } }));
vi.mock('@/services/notification-service', () => ({ notificationService: nMock }));
vi.mock('@/services/utilities/utils-service', () => ({ utilsService: utilsMock }));
vi.mock('@/services/filesystem/move-file-service', () => ({ moveFileService: { moveToAppTemporaryDir: vi.fn().mockResolvedValue() } }));
vi.mock('@whiteguru/capacitor-plugin-video-editor', () => ({ VideoEditor: {} }));
vi.mock('@/components/modals/ModalProgressEncoding', () => ({ default: {} }));
vi.mock('@ionic/vue', () => ({ modalController: { create: vi.fn().mockResolvedValue({ present: vi.fn() }), dismiss: vi.fn().mockResolvedValue() } }));

function setupRootStore(platform = PARAMETERS.ANDROID) {
    useRootStore.mockReturnValue({
        device: { platform },
        language: 'en',
        tempDir: '',
        isVideoEncodingModalActive: false,
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
    });

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

    it('does not persist a phantom filename when the user cancels the capture', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('granted');
        let errorCb;
        global.cordova = {
            plugins: {
                diagnostic: {
                    requestRuntimePermission: vi.fn((success, error) => {
                        errorCb = error;
                    }),
                    permissionStatus: {},
                    permission: {}
                }
            }
        };
        const { media, entryUuid, state, filename } = makeArgs();

        await videoShoot({ media, entryUuid, state, filename });
        //simulate the user cancelling the native video capture (Camera plugin code 3)
        errorCb({ code: 3 });

        expect(media[entryUuid]['q1'].cached).toBe('');
        expect(state.answer.answer).toBe('');
    });
});
