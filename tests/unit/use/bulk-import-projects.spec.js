import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'Please wait'
            }
        }
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/filesystem/temp-dirs-service', () => ({
    tempDirsService: {
        createTemporaryDir: vi.fn(),
        clearTemporaryDir: vi.fn()
    }
}));

vi.mock('@/use/project/import-project', () => ({
    importProject: vi.fn()
}));

vi.mock('@capgo/capacitor-zip', () => ({
    CapacitorZip: {
        unzip: vi.fn()
    }
}));

vi.mock('@capawesome/capacitor-file-picker', () => ({
    FilePicker: {
        copyFile: vi.fn()
    }
}));

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        readdir: vi.fn(),
        readFile: vi.fn()
    }
}));

describe('bulkImportProjects', () => {
    let bulkImportProjects;
    let useRootStore;
    let notificationService;
    let tempDirsService;
    let importProject;
    let CapacitorZip;
    let FilePicker;
    let Filesystem;

    const router = {
        replace: vi.fn()
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setActivePinia(createPinia());
        vi.spyOn(Date, 'now').mockReturnValue(12345);

        ({bulkImportProjects} = await import('@/use/project/bulk-import-projects'));
        ({useRootStore} = await import('@/stores/root-store'));
        ({notificationService} = await import('@/services/notification-service'));
        ({tempDirsService} = await import('@/services/filesystem/temp-dirs-service'));
        ({importProject} = await import('@/use/project/import-project'));
        ({CapacitorZip} = await import('@capgo/capacitor-zip'));
        ({FilePicker} = await import('@capawesome/capacitor-file-picker'));
        ({Filesystem} = await import('@capacitor/filesystem'));

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.device = {
            platform: 'android'
        };
        rootStore.tempDir = 'file:///tmp/ec5tmp';

        tempDirsService.createTemporaryDir.mockResolvedValue('file:///tmp/ec5tmp');
        tempDirsService.clearTemporaryDir.mockResolvedValue();
        FilePicker.copyFile.mockResolvedValue();
        CapacitorZip.unzip.mockResolvedValue();
        importProject.mockResolvedValue(true);
    });

    it('extracts the zip and imports JSON files sequentially', async () => {
        Filesystem.readdir.mockResolvedValue({
            files: [
                {name: 'b-project.json'},
                {name: 'a-project.json'},
                {name: 'notes.txt'}
            ]
        });
        Filesystem.readFile
            .mockResolvedValueOnce({data: JSON.stringify({data: {project: {ref: 'a'}}})})
            .mockResolvedValueOnce({data: JSON.stringify({data: {project: {ref: 'b'}}})});

        const result = await bulkImportProjects({path: 'file:///tmp/import.zip'}, router);

        expect(result).toBe(true);
        expect(FilePicker.copyFile).toHaveBeenCalledWith({
            from: 'file:///tmp/import.zip',
            to: '/tmp/ec5tmp/bulk-import.zip',
            overwrite: true
        });
        expect(CapacitorZip.unzip).toHaveBeenCalledWith({
            source: '/tmp/ec5tmp/bulk-import.zip',
            destination: '/tmp/ec5tmp/bulk-import-12345'
        });
        expect(Filesystem.readFile).toHaveBeenNthCalledWith(1, {
            path: '/tmp/ec5tmp/bulk-import-12345/a-project.json',
            encoding: 'utf8'
        });
        expect(Filesystem.readFile).toHaveBeenNthCalledWith(2, {
            path: '/tmp/ec5tmp/bulk-import-12345/b-project.json',
            encoding: 'utf8'
        });
        expect(importProject).toHaveBeenNthCalledWith(1, {data: {project: {ref: 'a'}}}, router);
        expect(importProject).toHaveBeenNthCalledWith(2, {data: {project: {ref: 'b'}}}, router);
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });

    it('returns false and alerts when the archive contains no JSON files', async () => {
        Filesystem.readdir.mockResolvedValue({
            files: [
                {name: 'readme.txt'}
            ]
        });

        const result = await bulkImportProjects({path: 'file:///tmp/import.zip'}, router);

        expect(result).toBe(false);
        expect(importProject).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            'No JSON files found in the ZIP archive'
        );
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });

    it('stops on the first import failure and still cleans up', async () => {
        Filesystem.readdir.mockResolvedValue({
            files: [
                {name: 'a-project.json'},
                {name: 'b-project.json'}
            ]
        });
        Filesystem.readFile
            .mockResolvedValueOnce({data: JSON.stringify({data: {project: {ref: 'a'}}})})
            .mockResolvedValueOnce({data: JSON.stringify({data: {project: {ref: 'b'}}})});
        importProject
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const result = await bulkImportProjects({path: 'file:///tmp/import.zip'}, router);

        expect(result).toBe(false);
        expect(importProject).toHaveBeenCalledTimes(1);
        expect(Filesystem.readFile).toHaveBeenCalledTimes(1);
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });

    it('shows the error and cleans up when unzip fails', async () => {
        CapacitorZip.unzip.mockRejectedValue(new Error('Bad zip'));

        const result = await bulkImportProjects({path: 'file:///tmp/import.zip'}, router);

        expect(result).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalledWith('Bad zip');
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });

    it('shows the error and cleans up when the picked file cannot be copied locally', async () => {
        FilePicker.copyFile.mockRejectedValue(new Error('copyFile failed.'));

        const result = await bulkImportProjects({path: 'content://picked/import.zip'}, router);

        expect(result).toBe(false);
        expect(CapacitorZip.unzip).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('copyFile failed.');
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });
});
