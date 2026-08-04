import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { entriesDownloadService } from '@/services/entries-download-service';
import { versioningService } from '@/services/utilities/versioning-service';
import { downloadService } from '@/services/utilities/download-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { modalController } from '@ionic/vue';

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                update_project: 'Update project',
                project_outdated: 'Project is outdated',
                are_you_sure: 'Are you sure?',
                clear_download_progress: 'Clear download progress',
                downloading_entries: 'Downloading entries',
                wait: 'Please Wait...',
                updating_project: 'Updating Forms.',
                download_warning: 'Download warning',
                download_remote_entries: 'Download remote entries',
                resume_last_download_message: 'Resume last download',
                resume_last_download: 'Resume',
                restart_download: 'Restart'
            },
            status_codes: {
                ec5_143: 'Entries downloaded',
                ec5_144: 'No entries found'
            }
        }
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        ACTIONS: {
            DOWNLOAD_RESUME: 'resume',
            DOWNLOAD_RESTART: 'restart'
        },
        AUTH_ERROR_CODES: [],
        DELAY_LONG: 1
    }
}));

vi.mock('@/components/modals/ModalProgressTransfer', () => ({default: {}}));

vi.mock('@/use/auth/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

vi.mock('@/use/auth/logout', () => ({
    logout: vi.fn()
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        checkProjectVersion: vi.fn(),
        updateProject: vi.fn()
    }
}));

vi.mock('@/services/utilities/download-service', () => ({
    downloadService: {
        downloadFormEntries: vi.fn()
    }
}));

vi.mock('@/services/utilities/entries-download-progress-service', () => ({
    entriesDownloadProgressService: {
        load: vi.fn(),
        save: vi.fn(),
        clear: vi.fn(),
        clearProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(),
        confirmMultiple: vi.fn(),
        showToast: vi.fn(),
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        handleWebError: vi.fn()
    }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteRemoteEntries: vi.fn()
    }
}));

const emptyProgress = {
    urls: {},
    startUrl: null,
    totalEntries: 0,
    processedEntries: 0,
    updatedAt: null
};

function createState() {
    return {
        forms: [{formRef: 'form-a'}, {formRef: 'form-b'}],
        completed: false,
        noEntriesFound: false,
        enabledButtons: {'form-a': true},
        entriesDownloaded: [],
        resumeAvailable: {},
        showWarning: false,
        wasAttemptedDownload: false,
        isFetching: false,
        promptOpen: false,
        downloadCache: {}
    };
}

const labels = {
    are_you_sure: 'Are you sure?',
    clear_download_progress: 'Clear download progress',
    downloading_entries: 'Downloading entries',
    download_warning: 'Download warning',
    download_remote_entries: 'Download remote entries',
    resume_last_download_message: 'Resume last download',
    resume_last_download: 'Resume',
    restart_download: 'Restart'
};

const projectModel = {
    getProjectRef: vi.fn(() => 'project-ref'),
    getFirstFormRef: vi.fn(() => 'form-a'),
    getLastFormRef: vi.fn(() => 'form-a'),
    getNextFormRef: vi.fn(() => 'form-b')
};

function createDownloader(state) {
    return entriesDownloadService.initDownloader({
        state,
        rootStore: {language: 'en', progressTransfer: {}},
        labels,
        language: 'en',
        projectModel
    });
}

describe('entriesDownloadService project version checks', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        versioningService.checkProjectVersion.mockResolvedValue(true);
        versioningService.updateProject.mockResolvedValue(true);
        downloadService.downloadFormEntries.mockResolvedValue(true);
        entriesDownloadProgressService.load.mockReturnValue({...emptyProgress});
        notificationService.confirmSingle.mockResolvedValue(true);
        notificationService.showProgressDialog.mockResolvedValue();
        databaseDeleteService.deleteRemoteEntries.mockResolvedValue();
        modalController.create.mockResolvedValue({present: vi.fn().mockResolvedValue()});
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function settleDownload() {
        await flushPromises();
        await vi.advanceTimersByTimeAsync(1);
        await flushPromises();
    }

    it('updates an outdated project before downloading entries', async () => {
        const state = createState();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(versioningService.updateProject).toHaveBeenCalledTimes(1);
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(
            'Please Wait...',
            'Updating Forms.'
        );
        expect(notificationService.hideProgressDialog).toHaveBeenCalledWith(0);
        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(notificationService.hideProgressDialog.mock.invocationCallOrder[0])
            .toBeLessThan(downloadService.downloadFormEntries.mock.invocationCallOrder[0]);
        expect(databaseDeleteService.deleteRemoteEntries).toHaveBeenCalledWith('project-ref', 'form-a');
        expect(databaseDeleteService.deleteRemoteEntries.mock.invocationCallOrder[0])
            .toBeLessThan(downloadService.downloadFormEntries.mock.invocationCallOrder[0]);
        expect(versioningService.updateProject.mock.invocationCallOrder[0])
            .toBeLessThan(downloadService.downloadFormEntries.mock.invocationCallOrder[0]);
    });

    it('clears project download progress and restarts instead of resuming after an update', async () => {
        const state = createState();
        state.downloadCache['form-a'] = {
            ...emptyProgress,
            startUrl: 'old-page',
            totalEntries: 10,
            processedEntries: 5,
            urls: {'old-page': 'old-next'}
        };
        state.resumeAvailable['form-a'] = true;
        versioningService.checkProjectVersion.mockResolvedValue(false);
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a', true);
        await settleDownload();

        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith('project-ref');
        expect(databaseDeleteService.deleteRemoteEntries).toHaveBeenCalledWith('project-ref', 'form-a');
        expect(downloadService.downloadFormEntries).toHaveBeenCalledWith('form-a', expect.objectContaining({
            startUrl: null,
            initialTotalEntries: 0,
            initialEntryNumber: 0
        }));
        expect(state.resumeAvailable['form-a']).toBe(false);
    });

    it('does not download when the user declines the project update', async () => {
        const state = createState();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        notificationService.confirmSingle.mockResolvedValue(false);
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteRemoteEntries).not.toHaveBeenCalled();
        expect(state.isFetching).toBe(false);
    });

    it('resumes cached progress when the project is current', async () => {
        const state = createState();
        state.downloadCache['form-a'] = {
            ...emptyProgress,
            startUrl: 'page-1',
            totalEntries: 10,
            processedEntries: 5,
            urls: {'page-1': 'page-2'}
        };
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a', true);
        await settleDownload();

        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).toHaveBeenCalledWith('form-a', expect.objectContaining({
            startUrl: 'page-1',
            initialTotalEntries: 10,
            initialEntryNumber: 5
        }));
        expect(databaseDeleteService.deleteRemoteEntries).not.toHaveBeenCalled();
    });

    it('does not download when updating the project fails', async () => {
        const state = createState();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        versioningService.updateProject.mockRejectedValue(new Error('update failed'));
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(errorsService.handleWebError).toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledWith(0);
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(state.isFetching).toBe(false);
    });

    it('cleans up the transfer state when the connection drops during entry download', async () => {
        const state = createState();
        downloadService.downloadFormEntries.mockRejectedValue(new Error('network unavailable'));
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(errorsService.handleWebError).toHaveBeenCalled();
        expect(modalController.dismiss).toHaveBeenCalled();
        expect(state.isFetching).toBe(false);
    });

    it('ignores accidental double taps while the download is starting', async () => {
        const state = createState();
        let resolveVersionCheck;
        versioningService.checkProjectVersion.mockReturnValue(new Promise((resolve) => {
            resolveVersionCheck = resolve;
        }));
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await flushPromises();
        await downloader.downloadEntries('form-a');

        expect(state.isFetching).toBe(true);
        expect(versioningService.checkProjectVersion).toHaveBeenCalledTimes(1);
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();

        resolveVersionCheck(true);
        await settleDownload();

        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(state.isFetching).toBe(false);
    });
});
