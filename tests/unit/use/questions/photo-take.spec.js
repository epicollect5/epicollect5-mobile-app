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

const utilsMock = vi.hoisted(() => ({
    generateMediaFilename: vi.fn().mockReturnValue('photo_gen.jpg'),
    generateTimestamp: vi.fn().mockReturnValue('123')
}));

vi.mock('@/stores/root-store', () => ({ useRootStore: vi.fn() }));
vi.mock('@/config', () => ({ PARAMETERS: { ANDROID: 'android', WEB: 'web', QUESTION_TYPES: { PHOTO: 'photo' } } }));
vi.mock('@/config/strings', () => ({ STRINGS: { en: { labels: {} } } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: vi.fn((s) => s) } }));
vi.mock('@capacitor/camera', () => ({ Camera: { getPhoto: vi.fn() }, CameraResultType: { Uri: 'uri' }, CameraSource: { Photos: 'photos', Camera: 'camera' } }));
vi.mock('@/services/notification-service', () => ({ notificationService: nMock }));
vi.mock('@/services/utilities/utils-service', () => ({ utilsService: utilsMock }));
vi.mock('@/services/filesystem/move-file-service', () => ({ moveFileService: { moveToAppTemporaryDir: vi.fn().mockResolvedValue() } }));

function setupRootStore(platform = PARAMETERS.ANDROID) {
    useRootStore.mockReturnValue({ device: { platform }, language: 'en', tempDir: '' });
}

function makeArgs(action = 'camera') {
    const entryUuid = 'entry1';
    const ref = 'q1';
    const media = { [entryUuid]: { [ref]: { cached: '', stored: '' } } };
    const state = { answer: { answer: '' }, inputDetails: { ref }, imageSource: '', fileSource: '' };
    return { media, entryUuid, state, filename: '', action };
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
        expect(state.answer.answer).toBe('');
    });

    it('triggers the notification flow when picking from the gallery', async () => {
        setupRootStore();
        nMock.startForegroundService.mockResolvedValue('open_settings');
        const { media, entryUuid, state, filename } = makeArgs('gallery');

        await photoTake({ media, entryUuid, state, filename, action: 'gallery' });

        expect(nMock.startForegroundService).toHaveBeenCalled();
        expect(Camera.getPhoto).not.toHaveBeenCalled();
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
});
