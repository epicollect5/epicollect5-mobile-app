import { vi, describe, it, expect, beforeEach } from 'vitest';
import { downloadFileService } from '@/services/download-file-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';

const device = { platform: 'android' };

vi.mock('@/config', () => ({
    PARAMETERS: {
        WEB: 'web',
        LOGOS_DIR: 'logos/'
    }
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        device,
        persistentDir: 'file:///data/user/0/uk.ac.imperial.epicollect.five/files/'
    }))
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        getHeaders: vi.fn(() => Promise.resolve({})),
        getProjectImageUrl: vi.fn(() => 'https://example.com/logo.jpg')
    }
}));

vi.mock('@/services/filesystem/media-dirs-service', () => ({
    mediaDirsService: {
        ensureProjectLogoDir: vi.fn(() => Promise.resolve(true))
    }
}));

describe('downloadFileService.downloadProjectLogo()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        device.platform = 'android';
        window.FileTransfer = vi.fn().mockImplementation(() => ({
            download: vi.fn((uri, filePath, success) => success({ toURL: () => filePath }))
        }));
    });

    it('ensures the logo directory exists before downloading', async () => {
        await downloadFileService.downloadProjectLogo('slug', 'ref123');

        expect(mediaDirsService.ensureProjectLogoDir).toHaveBeenCalledWith('ref123');

        const instance = window.FileTransfer.mock.results[0].value;
        expect(instance.download).toHaveBeenCalled();
        expect(instance.download.mock.calls[0][1]).toContain('logos/ref123/mobile-logo.jpg');

        expect(mediaDirsService.ensureProjectLogoDir.mock.invocationCallOrder[0])
            .toBeLessThan(instance.download.mock.invocationCallOrder[0]);
    });

    it('does not download on the web platform', async () => {
        device.platform = 'web';

        await downloadFileService.downloadProjectLogo('slug', 'ref123');

        expect(mediaDirsService.ensureProjectLogoDir).not.toHaveBeenCalled();
        expect(window.FileTransfer).not.toHaveBeenCalled();
    });

    it('rejects if the logo directory cannot be created', async () => {
        mediaDirsService.ensureProjectLogoDir.mockImplementation(() => Promise.reject(new Error('mkdir failed')));

        await expect(downloadFileService.downloadProjectLogo('slug', 'ref123')).rejects.toThrow('mkdir failed');
    });
});
