import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { entriesDownloadService } from '@/services/entries-download-service';
import { versioningService } from '@/services/utilities/versioning-service';
import { downloadService } from '@/services/utilities/download-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';
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
                unsynced_entries: 'Unsynced entries',
                remote_entries_out_of_sync: 'Entries on your device are out of sync. Upload your entries before re-downloading.',
                resume_last_download_message: 'Resume last download',
                resume_last_download: 'Resume',
                restart_download: 'Restart'
            },
            status_codes: {
                ec5_11: 'Project does not exist',
                ec5_137: 'Forms updated.',
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
        DELAY_LONG: 1,
        DOWNLOAD_ENTRIES_DOCS_URL: 'https://docs.epicollect.net/mobile-application/download-entries'
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

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteEntriesBeforeDownload: vi.fn()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countUnsyncedEntries: vi.fn(),
        countMediaUnsynced: vi.fn()
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
    unsynced_entries: 'Unsynced entries',
    remote_entries_out_of_sync: 'Entries on your device are out of sync. Upload your entries before re-downloading.',
    resume_last_download_message: 'Resume last download',
    resume_last_download: 'Resume',
    restart_download: 'Restart'
};

const projectModel = {
    getProjectRef: vi.fn(() => 'project-ref'),
    getFirstFormRef: vi.fn(() => 'form-a'),
    getLastFormRef: vi.fn(() => 'form-a'),
    getNextFormRef: vi.fn(() => 'form-b'),
    getFormsInOrder: vi.fn(() => [{formRef: 'form-a'}, {formRef: 'form-b'}])
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
        databaseDeleteService.deleteEntriesBeforeDownload.mockResolvedValue();
        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries_unsynced: 0,
                    total_number_of_entries_with_errors: 0,
                    total_number_of_incomplete_entries: 0
                })
            }
        });
        databaseSelectService.countMediaUnsynced.mockResolvedValue({
            rows: {
                item: () => ({total: 0})
            }
        });
        notificationService.showDismissAlert.mockResolvedValue();
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

    it('updates an outdated project but does not start a download until the user taps again', async () => {
        const state = createState();
        state.enabledButtons['form-b'] = true;
        versioningService.checkProjectVersion.mockResolvedValue(false);
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-b');
        await settleDownload();

        expect(versioningService.updateProject).toHaveBeenCalledTimes(1);
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(
            'Please Wait...',
            'Updating Forms.'
        );
        expect(notificationService.hideProgressDialog).toHaveBeenCalledWith(0);
        expect(notificationService.showAlert).toHaveBeenCalledWith('Forms updated.', 'Project is outdated');
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(state.enabledButtons['form-a']).toBe(true);
        expect(state.enabledButtons['form-b']).toBe(false);
        expect(state.resumeAvailable['form-a']).toBe(false);
        expect(state.isFetching).toBe(false);
    });

    it('downloads the first form again after the update has reset the buttons', async () => {
        const state = createState();
        versioningService.checkProjectVersion
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(databaseDeleteService.deleteEntriesBeforeDownload).toHaveBeenCalledWith('project-ref', ['form-a', 'form-b']);
        expect(state.enabledButtons['form-a']).toBe(true);
    });

    it('blocks a fresh download when any entries are unsynced, with errors or incomplete', async () => {
        const state = createState();
        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries_unsynced: 1,
                    total_number_of_entries_with_errors: 0,
                    total_number_of_incomplete_entries: 0
                })
            }
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(databaseSelectService.countUnsyncedEntries).toHaveBeenCalledWith('project-ref');
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'Entries on your device are out of sync. Upload your entries before re-downloading.',
            'Unsynced entries',
            'https://docs.epicollect.net/mobile-application/download-entries'
        );
        expect(state.resumeAvailable['form-a']).toBe(false);
        expect(state.isFetching).toBe(false);
    });

    it('blocks a fresh download when there are incomplete entries', async () => {
        const state = createState();
        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries_unsynced: 0,
                    total_number_of_entries_with_errors: 0,
                    total_number_of_incomplete_entries: 2
                })
            }
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(notificationService.showDismissAlert).toHaveBeenCalled();
        expect(state.resumeAvailable['form-a']).toBe(false);
    });

    it('blocks a fresh download when any media file is unsynced', async () => {
        const state = createState();
        databaseSelectService.countMediaUnsynced.mockResolvedValue({
            rows: {
                item: () => ({total: 1})
            }
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(databaseSelectService.countMediaUnsynced).toHaveBeenCalledWith('project-ref');
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(notificationService.showDismissAlert).toHaveBeenCalled();
        expect(state.resumeAvailable['form-a']).toBe(false);
    });

    it('wipes the current form and all following forms on a fresh download', async () => {
        const state = createState();
        state.enabledButtons['form-b'] = true;
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-b');
        await settleDownload();

        expect(databaseDeleteService.deleteEntriesBeforeDownload).toHaveBeenCalledWith('project-ref', ['form-b']);
        expect(downloadService.downloadFormEntries).toHaveBeenCalledWith('form-b', expect.anything());
    });

    it('clears the download caches of the following forms on a fresh download', async () => {
        const state = createState();
        state.downloadCache['form-b'] = {
            ...emptyProgress,
            startUrl: 'page-1',
            totalEntries: 10,
            processedEntries: 5,
            urls: {'page-1': 'page-2'}
        };
        state.resumeAvailable['form-b'] = true;
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(entriesDownloadProgressService.clear).toHaveBeenCalledWith('project-ref', 'form-b');
        expect(state.resumeAvailable['form-b']).toBe(false);
        expect(state.downloadCache['form-b']).toBeUndefined();
        expect(databaseDeleteService.deleteEntriesBeforeDownload).toHaveBeenCalledWith('project-ref', ['form-a', 'form-b']);
    });

    it('resets the selected and following form state before a fresh download', async () => {
        const state = createState();
        state.completed = true;
        state.enabledButtons['form-a'] = false;
        state.enabledButtons['form-b'] = true;
        state.entriesDownloaded['form-a'] = true;
        state.entriesDownloaded['form-b'] = true;
        downloadService.downloadFormEntries.mockImplementation(async () => {
            expect(state.completed).toBe(false);
            expect(state.enabledButtons['form-a']).toBe(true);
            expect(state.entriesDownloaded['form-a']).toBe(false);
            expect(state.enabledButtons['form-b']).toBe(false);
            expect(state.entriesDownloaded['form-b']).toBe(false);
            return true;
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        expect(databaseDeleteService.deleteEntriesBeforeDownload).toHaveBeenCalledWith('project-ref', ['form-a', 'form-b']);
    });

    it('clears project download progress and does not resume after an update', async () => {
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
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(state.resumeAvailable['form-a']).toBe(false);
        expect(state.enabledButtons['form-a']).toBe(true);
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
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
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
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
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

        const firstDownload = downloader.downloadEntries('form-a');
        await flushPromises();
        await downloader.downloadEntries('form-a');

        expect(state.isFetching).toBe(true);
        expect(versioningService.checkProjectVersion).toHaveBeenCalledTimes(1);
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();

        resolveVersionCheck(true);
        await settleDownload();
        await firstDownload;

        expect(downloadService.downloadFormEntries).toHaveBeenCalledTimes(1);
        expect(state.isFetching).toBe(false);
    });

    it('blocks a fresh download when the project was trashed (ec5_11)', async () => {
        const state = createState();
        versioningService.checkProjectVersion.mockRejectedValue({
            data: {
                errors: [{code: 'ec5_11'}]
            },
            status: 400
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a');
        await settleDownload();

        //Project trashed: no update prompt, no local wipe, no download
        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(notificationService.confirmSingle).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        //The user is told the project does not exist
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project does not exist');
        expect(state.isFetching).toBe(false);
    });

    it('blocks a resumed download when the project was trashed (ec5_11)', async () => {
        const state = createState();
        state.downloadCache['form-a'] = {
            ...emptyProgress,
            startUrl: 'page-1',
            totalEntries: 10,
            processedEntries: 5,
            urls: {'page-1': 'page-2'}
        };
        state.resumeAvailable['form-a'] = true;
        versioningService.checkProjectVersion.mockRejectedValue({
            data: {
                errors: [{code: 'ec5_11'}]
            },
            status: 400
        });
        const downloader = createDownloader(state);

        await downloader.downloadEntries('form-a', true);
        await settleDownload();

        expect(downloadService.downloadFormEntries).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteEntriesBeforeDownload).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project does not exist');
        expect(state.resumeAvailable['form-a']).toBe(true);
        expect(state.isFetching).toBe(false);
    });
});
