import { describe, it, expect, beforeEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { STRINGS } from '@/config/strings';
import { entriesDownloadService } from '@/services/entries-download-service';
import { downloadService } from '@/services/utilities/download-service';
import { versioningService } from '@/services/utilities/versioning-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { modalController } from '@ionic/vue';

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                update_project: 'Update project',
                project_outdated: 'Project is outdated',
                wait: 'Please Wait...',
                updating_project: 'Updating Forms.'
            },
            status_codes: {
                ec5_11: 'Project does not exist',
                ec5_137: 'Not found'
            }
        }
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: [],
        ACTIONS: {
            DOWNLOAD_RESUME: 'download-resume',
            DOWNLOAD_RESTART: 'download-restart'
        },
        DELAY_LONG: 1000,
        DOWNLOAD_ENTRIES_DOCS_URL: 'https://docs.epicollect.net/mobile-application/download-entries'
    }
}));

vi.mock('@/components/modals/ModalProgressTransfer', () => ({
    default: {}
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/use/auth/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

vi.mock('@/use/auth/logout', () => ({
    logout: vi.fn()
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(),
        confirmMultiple: vi.fn(),
        showDismissAlert: vi.fn(),
        showAlert: vi.fn(),
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

vi.mock('@/services/utilities/download-service', () => ({
    downloadService: {
        downloadFormEntries: vi.fn()
    }
}));

vi.mock('@/services/utilities/entries-download-progress-service', () => ({
    entriesDownloadProgressService: {
        save: vi.fn(),
        load: vi.fn(() => ({ urls: {}, startUrl: null, totalEntries: 0, processedEntries: 0, updatedAt: null })),
        clear: vi.fn(),
        clearProject: vi.fn()
    }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteEntriesBeforeDownload: vi.fn(),
        deleteFormEntries: vi.fn()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countUnsyncedEntries: vi.fn(),
        countMediaUnsynced: vi.fn()
    }
}));

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        checkProjectVersion: vi.fn(),
        updateProject: vi.fn()
    }
}));

const labels = {
    download_interrupted_restart: 'The project was updated while downloading. The download was stopped. Please restart the download, as the entries already downloaded might be invalid',
    download_warning: 'Download warning',
    remote_entries_out_of_sync: 'Remote entries on your device are out of sync. Upload your entries before re-downloading.',
    unsynced_entries: 'Unsynced entries',
    resume_last_download_message: 'A previous download stopped before completion. Do you want to resume it or restart from the beginning?',
    resume_last_download: 'Resume',
    restart_download: 'Restart download'
};

const createState = () => ({
    completed: false,
    noEntriesFound: false,
    enabledButtons: {},
    entriesDownloaded: {},
    downloadCache: {},
    resumeAvailable: {},
    wasAttemptedDownload: false,
    showWarning: false,
    isFetching: false,
    promptOpen: false,
    forms: []
});

const rootStore = {
    language: 'en',
    nextRoute: null,
    routeParams: {}
};

const projectModel = {
    getProjectRef: vi.fn(() => 'project-ref'),
    getFormRef: vi.fn(() => 'form-a'),
    getFormsInOrder: vi.fn(),
    getFirstFormRef: vi.fn(),
    getLastFormRef: vi.fn(),
    getNextFormRef: vi.fn()
};

const init = (state = createState()) =>
    entriesDownloadService.initDownloader({
        state,
        rootStore,
        labels,
        language: 'en',
        projectModel
    });

describe('entriesDownloadService mid-download project update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        versioningService.checkProjectVersion.mockResolvedValue(true);
        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries_with_errors: 0,
                    total_number_of_entries_unsynced: 0,
                    total_number_of_incomplete_entries: 0
                })
            }
        });
        databaseSelectService.countMediaUnsynced.mockResolvedValue({
            rows: {
                item: () => ({ total: 0 })
            }
        });
        databaseDeleteService.deleteEntriesBeforeDownload.mockResolvedValue();
        modalController.create.mockResolvedValue({ present: vi.fn() });
        modalController.dismiss.mockResolvedValue();
        projectModel.getFormsInOrder.mockReturnValue([{ formRef: 'form-a' }, { formRef: 'form-b' }]);
        projectModel.getFirstFormRef.mockReturnValue('form-a');
        projectModel.getLastFormRef.mockReturnValue('form-b');
        projectModel.getNextFormRef.mockReturnValue('form-b');
    });

    it('aborts the download, clears all progress and invites a restart when the project changed mid-download', async () => {
        downloadService.downloadFormEntries.mockRejectedValue({
            versionChanged: true,
            projectUpdated: false
        });
        const state = createState();
        const downloader = init(state);

        await downloader.downloadEntries('form-a');
        await flushPromises();

        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalled();
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith('project-ref');
        expect(state.resumeAvailable['form-a']).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.download_interrupted_restart, STRINGS.en.labels.project_outdated);
        //Buttons are reset to the first form only
        expect(state.enabledButtons['form-a']).toBe(true);
        expect(state.enabledButtons['form-b']).toBe(false);
        expect(state.isFetching).toBe(false);
    });

    it('runs the guard and the wipe before the download, even when it aborts later', async () => {
        downloadService.downloadFormEntries.mockRejectedValue({
            versionChanged: true,
            projectUpdated: false
        });
        const state = createState();
        const downloader = init(state);

        await downloader.downloadEntries('form-a');
        await flushPromises();

        expect(databaseSelectService.countUnsyncedEntries).toHaveBeenCalledWith('project-ref');
        expect(databaseSelectService.countMediaUnsynced).toHaveBeenCalledWith('project-ref');
        expect(databaseDeleteService.deleteEntriesBeforeDownload).toHaveBeenCalledWith('project-ref', ['form-a', 'form-b']);
    });

    it('passes a per-chunk version check to the download', async () => {
        downloadService.downloadFormEntries.mockResolvedValue(true);
        const state = createState();
        const downloader = init(state);

        await downloader.downloadEntries('form-a');
        await flushPromises();

        const options = downloadService.downloadFormEntries.mock.calls[0][1];
        expect(typeof options.shouldAbort).toBe('function');

        //Project up to date: keep downloading
        await expect(options.shouldAbort()).resolves.toBeNull();

        //Project outdated and the user declines the update: abort
        versioningService.checkProjectVersion.mockResolvedValue(false);
        notificationService.confirmSingle.mockResolvedValue(false);
        await expect(options.shouldAbort()).resolves.toEqual({ versionChanged: true, projectUpdated: false });

        //Project outdated and the user updates: abort
        notificationService.confirmSingle.mockResolvedValue(true);
        versioningService.updateProject.mockResolvedValue();
        await expect(options.shouldAbort()).resolves.toEqual({ versionChanged: true, projectUpdated: true });
    });

    it('aborts without the restart prompt when the project was trashed mid-download', async () => {
        const trashedError = {
            data: {
                errors: [{ code: 'ec5_11' }]
            },
            status: 400
        };
        //First check (before the download) passes, then the project is trashed
        versioningService.checkProjectVersion
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(trashedError);
        //Simulate the real download loop: abort when the per-chunk check says so
        downloadService.downloadFormEntries.mockImplementation(async (_formRef, options) => {
            const abortReason = await options.shouldAbort();
            if (abortReason) {
                throw abortReason;
            }
            return true;
        });
        const state = createState();
        const downloader = init(state);

        await downloader.downloadEntries('form-a');
        await flushPromises();

        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalled();
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith('project-ref');
        //The trashed alert comes from the version check, not a restart prompt
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(
            labels.download_interrupted_restart,
            STRINGS.en.labels.project_outdated
        );
        expect(state.isFetching).toBe(false);
    });

    it('propagates projectTrashed from the per-chunk version check', async () => {
        const downloader = init(createState());
        await downloader.downloadEntries('form-a');
        await flushPromises();

        const options = downloadService.downloadFormEntries.mock.calls[0][1];

        //Project trashed mid-download: abort with the trashed flag
        versioningService.checkProjectVersion.mockRejectedValue({
            data: {
                errors: [{code: 'ec5_11'}]
            },
            status: 400
        });
        await expect(options.shouldAbort()).resolves.toEqual({
            versionChanged: true,
            projectUpdated: false,
            projectTrashed: true
        });
    });
});
