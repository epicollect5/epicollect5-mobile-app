import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn(),
        showValidationErrorAlert: vi.fn()
    }
}));

vi.mock('@/services/filesystem/temp-dirs-service', () => ({
    tempDirsService: {
        createTemporaryDir: vi.fn(),
        clearTemporaryDir: vi.fn()
    }
}));

vi.mock('@/use/project/validate-project-payload', () => ({
    validateProjectPayload: vi.fn()
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

describe('bulkValidateProjects', () => {
    let bulkValidateProjects;
    let useRootStore;
    let notificationService;
    let tempDirsService;
    let validateProjectPayload;
    let CapacitorZip;
    let FilePicker;
    let Filesystem;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setActivePinia(createPinia());
        vi.spyOn(Date, 'now').mockReturnValue(12345);

        ({bulkValidateProjects} = await import('@/use/project/bulk-validate-projects'));
        ({useRootStore} = await import('@/stores/root-store'));
        ({notificationService} = await import('@/services/notification-service'));
        ({tempDirsService} = await import('@/services/filesystem/temp-dirs-service'));
        ({validateProjectPayload} = await import('@/use/project/validate-project-payload'));
        ({CapacitorZip} = await import('@capgo/capacitor-zip'));
        ({FilePicker} = await import('@capawesome/capacitor-file-picker'));
        ({Filesystem} = await import('@capacitor/filesystem'));

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.device = {platform: 'android'};

        tempDirsService.createTemporaryDir.mockResolvedValue('file:///tmp/ec5tmp');
        tempDirsService.clearTemporaryDir.mockResolvedValue();
        FilePicker.copyFile.mockResolvedValue();
        CapacitorZip.unzip.mockResolvedValue();
    });

    it('validates all json files and shows a batch report', async () => {
        Filesystem.readdir.mockResolvedValue({
            files: [{name: 'a.json'}, {name: 'b.json'}]
        });
        Filesystem.readFile
            .mockResolvedValueOnce({data: '{"data":{}}'})
            .mockResolvedValueOnce({data: '{"data":{}}'});
        validateProjectPayload
            .mockResolvedValueOnce({projectLabel: 'alpha'})
            .mockRejectedValueOnce(new Error('Broken schema'));

        const result = await bulkValidateProjects({path: 'file:///tmp/projects.zip'});

        expect(result).toBe(false);
        expect(validateProjectPayload).toHaveBeenCalledTimes(2);
        expect(notificationService.showValidationErrorAlert).toHaveBeenCalledWith(
            expect.stringContaining('Bulk validation report'),
            expect.stringContaining('Failed: 1')
        );
        expect(tempDirsService.clearTemporaryDir).toHaveBeenCalledTimes(1);
    });
});
