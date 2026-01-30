import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneEntry } from '@/use/clone-entry';
import { cloneEntryBranch } from '@/use/clone-entry-branch';
import { notificationService } from '@/services/notification-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { entryCommonService } from '@/services/entry/entry-common-service';

// 1. Mock the services
vi.mock('@/services/notification-service');
vi.mock('@/services/database/database-insert-service');
vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getProjectRef = vi.fn();
    return { projectModel };
});
vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            status_codes: {
                ec5_393: 'Do you want to clone this entry?'
            }
        }
    }
}));
vi.mock('rollbar', () => {
    return {
        // Wrapping default in quotes fixes the "Reserved word" error
        'default': class {
            error() {}
            info() {}
            warn() {}
            critical() {}
            configure() {}
        }
    };
});

describe('cloneEntry', () => {
    let state, router, rootStore, labels, goBack;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup dummy dependencies
        state = {
            entry: { synced: 1 }, // Default to synced
            formRef: 'form_abc'
        };
        router = { replace: vi.fn() };
        rootStore = {};
        labels = {
            cannot_clone_incomplete_entry: 'Cannot clone incomplete entry',
            entry_cloned: 'Entry cloned'
        };
        goBack = vi.fn();
    });

    it('should show alert and bail if entry is incomplete', async () => {
        state.entry.synced = PARAMETERS.SYNCED_CODES.INCOMPLETE;

        await cloneEntry(state, router, rootStore, 'en', labels);

        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.cannot_clone_incomplete_entry);
        expect(databaseInsertService.insertCloneEntry).not.toHaveBeenCalled();
    });

    it('should NOT clone if user cancels the confirmation', async () => {
        notificationService.confirmSingle.mockResolvedValue(false);

        await cloneEntry(state, router, rootStore, 'en', labels);

        expect(databaseInsertService.insertCloneEntry).not.toHaveBeenCalled();
    });

    it('should clone entry when confirmed', async () => {

        projectModel.getExtraForm = vi.fn().mockReturnValue({});
        projectModel.getExtraInputs = vi.fn().mockReturnValue({});
        entryCommonService.setEntryTitle = vi.fn().mockReturnValue(null);
        projectModel.getMediaQuestions = vi.fn().mockReturnValue([]);
        projectModel.getFormBranches = vi.fn().mockReturnValue({});

        // 3. Your existing setup
        notificationService.confirmSingle.mockResolvedValue(true);
        databaseInsertService.insertCloneEntry.mockResolvedValue(true);

        // 4. Run the test
        await cloneEntry(state, router, rootStore, 'en', labels);

        // Assertions
        expect(databaseInsertService.insertCloneEntry).toHaveBeenCalled();
        expect(router.replace).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: expect.any(Number)
            }
        });
        expect(notificationService.showToast).toHaveBeenCalledWith(labels.entry_cloned);
    });

    it('should clone branch entry when confirmed', async () => {

        projectModel.getExtraForm = vi.fn().mockReturnValue({});
        projectModel.getExtraInputs = vi.fn().mockReturnValue({});
        entryCommonService.setEntryTitle = vi.fn().mockReturnValue(null);
        projectModel.getMediaQuestions = vi.fn().mockReturnValue([]);
        projectModel.getFormBranches = vi.fn().mockReturnValue({});

        // 3. Your existing setup
        notificationService.confirmSingle.mockResolvedValue(true);
        databaseInsertService.insertCloneEntryBranch.mockResolvedValue(true);

        // 4. Run the test
        await cloneEntryBranch(state,  'en', labels, goBack);

        // Assertions
        expect(databaseInsertService.insertCloneEntryBranch).toHaveBeenCalled();
        expect(goBack).toHaveBeenCalled();
        expect(notificationService.showToast).toHaveBeenCalledWith(labels.entry_cloned);
    });


    it('should show error alert when cloning fails', async () => {
        projectModel.getExtraForm = vi.fn().mockReturnValue({});
        projectModel.getExtraInputs = vi.fn().mockReturnValue({});
        entryCommonService.setEntryTitle = vi.fn().mockReturnValue(null);
        projectModel.getMediaQuestions = vi.fn().mockReturnValue([]);
        projectModel.getFormBranches = vi.fn().mockReturnValue({});

        notificationService.confirmSingle.mockResolvedValue(true);
        databaseInsertService.insertCloneEntry.mockRejectedValue(new Error('DB error'));

        await cloneEntry(state, router, rootStore, 'en', labels);

        expect(notificationService.showAlert).toHaveBeenCalled();
        expect(router.replace).not.toHaveBeenCalled();
    });
});
