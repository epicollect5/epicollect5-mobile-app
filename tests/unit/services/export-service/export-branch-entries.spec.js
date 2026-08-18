import {describe, it, expect, vi, beforeEach} from 'vitest';
import {exportService} from '@/services/export-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {notificationService} from '@/services/notification-service';
import {writeFileService} from '@/services/filesystem/write-file-service';
import {projectModel} from '@/models/project-model';
import {useRootStore} from '@/stores/root-store';
import {JSONTransformerService} from '@/services/utilities/json-transformer-service';
import {Capacitor} from '@capacitor/core';
import {Directory} from '@capacitor/filesystem';

vi.mock('@/stores/root-store');
vi.mock('@/services/utilities/utils-service');
vi.mock('@/services/notification-service');
vi.mock('@/services/utilities/rollbar-service');
vi.mock('@/services/filesystem/media-dirs-service');
vi.mock('@/services/filesystem/export-media-service');
vi.mock('@/services/filesystem/delete-file-service');
vi.mock('@/use/modals/use-modal-progress-export');
vi.mock('@capgo/capacitor-zip', () => ({CapacitorZip: {zip: vi.fn()}}));
vi.mock('@capacitor/share', () => ({Share: {share: vi.fn()}}));
vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectDistinctBranchRefs: vi.fn(),
        selectOneBranchEntryForExport: vi.fn()
    }
}));
vi.mock('@/services/filesystem/write-file-service', () => ({
    writeFileService: {appendCSVRow: vi.fn()}
}));
vi.mock('@/services/utilities/json-transformer-service', () => ({
    JSONTransformerService: {
        getBranchCSVHeaders: vi.fn(),
        getBranchCSVRow: vi.fn()
    }
}));
vi.mock('@/models/project-model');
vi.mock('@capacitor/core', () => ({
    Capacitor: {isNativePlatform: vi.fn()}
}));
vi.mock('@capacitor/filesystem', () => ({
    Directory: {Documents: 'DOCUMENTS'},
    Filesystem: {
        getUri: vi.fn(),
        deleteFile: vi.fn(),
        rmdir: vi.fn()
    }
}));
vi.mock('@/config', () => ({
    PARAMETERS: {
        DEBUG: false
    }
}));

const MOCK_PROJECT_REF = 'project-ref-123';

function mockRows(rows) {
    return {
        rows: {
            length: rows.length,
            item: (index) => rows[index]
        }
    };
}

describe('exportService.exportBranchEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useRootStore.mockReturnValue({
            progressExport: {total: 5, done: 0}
        });

        Capacitor.isNativePlatform.mockReturnValue(true);
        JSONTransformerService.getBranchCSVHeaders.mockReturnValue('h1,h2');
        JSONTransformerService.getBranchCSVRow.mockReturnValue('v1,v2');
        writeFileService.appendCSVRow.mockResolvedValue(undefined);

        projectModel.getProjectExtra.mockReturnValue({
            inputs: {
                'branch-kept': {data: {}}
            }
        });
        projectModel.getExtraForm.mockImplementation((formRef) => {
            if (formRef === 'kept-form' || formRef === 'kept-form-2') {
                return {details: {ref: formRef}};
            }
            return {};
        });

        databaseSelectService.selectOneBranchEntryForExport.mockImplementation(
            (projectRef, ownerInputRef, offset) => {
                if (offset === 0) {
                    return Promise.resolve(mockRows([{
                        entry_uuid: 'entry-' + ownerInputRef,
                        answers: '{}'
                    }]));
                }
                return Promise.resolve(mockRows([]));
            });
    });

    it('skips orphaned branches whose form was removed from the project', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([
            {form_ref: 'removed-form', owner_input_ref: 'branch-orphan'},
            {form_ref: 'kept-form', owner_input_ref: 'branch-kept'}
        ]));

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).toHaveBeenCalledTimes(1);
        expect(writeFileService.appendCSVRow).toHaveBeenCalledWith(
            'h1,h2',
            'v1,v2',
            'kept-form',
            0,
            'branch-kept',
            Directory.Documents
        );
    });

    it('skips orphaned branches when the project forms are missing', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([
            {form_ref: 'removed-form', owner_input_ref: 'branch-orphan'}
        ]));
        projectModel.getProjectExtra.mockReturnValue({
            inputs: {
                'branch-orphan': {data: {}}
            }
        });

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).not.toHaveBeenCalled();
        expect(databaseSelectService.selectOneBranchEntryForExport).not.toHaveBeenCalled();
    });

    it('skips orphaned branches whose input was removed from a kept form', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([
            {form_ref: 'kept-form', owner_input_ref: 'branch-input-removed'},
            {form_ref: 'kept-form', owner_input_ref: 'branch-kept'}
        ]));

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).toHaveBeenCalledTimes(1);
        expect(writeFileService.appendCSVRow).toHaveBeenCalledWith(
            'h1,h2',
            'v1,v2',
            'kept-form',
            0,
            'branch-kept',
            Directory.Documents
        );
    });

    it('resolves without writing anything when all branches are orphaned', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([
            {form_ref: 'removed-form', owner_input_ref: 'branch-orphan-1'},
            {form_ref: 'removed-form', owner_input_ref: 'branch-orphan-2'}
        ]));

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).not.toHaveBeenCalled();
        expect(databaseSelectService.selectOneBranchEntryForExport).not.toHaveBeenCalled();
    });

    it('exports every branch when none are orphaned', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([
            {form_ref: 'kept-form', owner_input_ref: 'branch-kept'},
            {form_ref: 'kept-form-2', owner_input_ref: 'branch-kept-2'}
        ]));
        projectModel.getExtraForm.mockImplementation((formRef) => {
            if (formRef === 'kept-form' || formRef === 'kept-form-2') {
                return {details: {ref: formRef}};
            }
            return {};
        });
        projectModel.getProjectExtra.mockReturnValue({
            inputs: {
                'branch-kept': {data: {}},
                'branch-kept-2': {data: {}}
            }
        });

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).toHaveBeenCalledTimes(2);
        expect(writeFileService.appendCSVRow).toHaveBeenCalledWith(
            'h1,h2',
            'v1,v2',
            'kept-form-2',
            0,
            'branch-kept-2',
            Directory.Documents
        );
    });

    it('resolves when there are no branches at all', async () => {
        databaseSelectService.selectDistinctBranchRefs.mockResolvedValue(mockRows([]));

        await expect(exportService.exportBranchEntries(MOCK_PROJECT_REF)).resolves.toBeUndefined();

        expect(writeFileService.appendCSVRow).not.toHaveBeenCalled();
    });
});
