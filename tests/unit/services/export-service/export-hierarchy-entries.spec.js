import {describe, it, expect, vi, beforeEach} from 'vitest';
import {exportService} from '@/services/export-service';
import {projectModel} from '@/models/project-model';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings';

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
vi.mock('@/services/database/database-select-service');
vi.mock('@/services/filesystem/write-file-service');
vi.mock('@/services/utilities/json-transformer-service');
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
        DEBUG: false,
        PROJECT_VERSION_DOCS_URL: 'https://docs.example/project-version'
    }
}));

const MOCK_PROJECT_REF = 'project-ref-123';

describe('exportService.hasExportMapping', () => {

    it('should be false for the mappings a legacy project row can hold', () => {
        //`projects.mapping` NULL: JSON.parse(null) returns null
        projectModel.getProjectMappings.mockReturnValue(null);
        expect(exportService.hasExportMapping()).toBe(false);

        //missing column / never loaded
        projectModel.getProjectMappings.mockReturnValue(undefined);
        expect(exportService.hasExportMapping()).toBe(false);

        //the project model default before any mapping is loaded
        projectModel.getProjectMappings.mockReturnValue({});
        expect(exportService.hasExportMapping()).toBe(false);

        //a project with no forms has nothing to export anyway
        projectModel.getProjectMappings.mockReturnValue([]);
        expect(exportService.hasExportMapping()).toBe(false);
    });

    it('should be true when the project has at least one mapping', () => {
        projectModel.getProjectMappings.mockReturnValue([{is_default: true, forms: {}}]);
        expect(exportService.hasExportMapping()).toBe(true);
    });
});

describe('exportService.exportHierarchyEntries without a mapping', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        useRootStore.mockReturnValue({language: 'en'});
    });

    it('should reject with the incompatible version message for a null mapping', async () => {
        projectModel.getProjectMappings.mockReturnValue(null);

        await expect(exportService.exportHierarchyEntries(MOCK_PROJECT_REF))
            .rejects.toBe(STRINGS.en.labels.project_version_incompatible);
    });

    it('should reject with the incompatible version message for an empty mapping', async () => {
        projectModel.getProjectMappings.mockReturnValue([]);

        await expect(exportService.exportHierarchyEntries(MOCK_PROJECT_REF))
            .rejects.toBe(STRINGS.en.labels.project_version_incompatible);
    });
});
