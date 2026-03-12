import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileService } from '@/services/filesystem/write-file-service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
        appendFile: vi.fn()
    },
    Directory: {
        Documents: 'Documents',
        Data: 'DATA'
    },
    Encoding: {
        UTF8: 'utf8'
    }
}));
vi.mock('@/models/project-model.js');
vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        generateFilenameForExport: vi.fn(),
        getExportPath: vi.fn()
    }
}));

describe('writeFileService', () => {

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getCSVFilePath', () => {
        it('should return correct file path for a form (Documents)', () => {
            projectModel.getSlug.mockReturnValue('my-project');
            projectModel.getFormIndex.mockReturnValue(0);
            projectModel.getFormName.mockReturnValue('Test Form');
            utilsService.generateFilenameForExport.mockReturnValue('form-1_test-form');
            utilsService.getExportPath.mockReturnValue('Epicollect5/my-project');

            const path = writeFileService.getCSVFilePath('form1', null, Directory.Documents);

            expect(utilsService.getExportPath).toHaveBeenCalledWith('my-project', Directory.Documents);
            expect(path).toBe('Epicollect5/my-project/data/form-1_test-form.csv');
        });

        it('should return correct archive path for a form (Data)', () => {
            projectModel.getSlug.mockReturnValue('my-project');
            projectModel.getFormIndex.mockReturnValue(0);
            projectModel.getFormName.mockReturnValue('Test Form');
            utilsService.generateFilenameForExport.mockReturnValue('form-1_test-form');
            utilsService.getExportPath.mockReturnValue('archive/my-project');

            const path = writeFileService.getCSVFilePath('form1', null, Directory.Data);

            expect(utilsService.getExportPath).toHaveBeenCalledWith('my-project', Directory.Data);
            expect(path).toBe('archive/my-project/data/form-1_test-form.csv');
        });

        it('should return correct file path for a branch', () => {
            projectModel.getSlug.mockReturnValue('my-project');
            projectModel.getFormIndex.mockReturnValue(0);
            projectModel.getFormName.mockReturnValue('Test Form');
            projectModel.getProjectMappings.mockReturnValue([{
                is_default: true,
                forms: {
                    form1: {
                        branch1: {}
                    }
                }
            }]);
            projectModel.getProjectExtra.mockReturnValue({
                inputs: {
                    branch1: {
                        data: {
                            question: 'Branch Question'
                        }
                    }
                }
            });
            utilsService.generateFilenameForExport.mockReturnValue('form-1_branch-branch1_test-form-branch-question');
            utilsService.getExportPath.mockReturnValue('Epicollect5/my-project');

            const path = writeFileService.getCSVFilePath('form1', 'branch1', Directory.Documents);

            expect(utilsService.generateFilenameForExport).toHaveBeenCalledWith('form-1_branch-branch1', 'Test Form-Branch Question');
            expect(path).toBe('Epicollect5/my-project/data/form-1_branch-branch1_test-form-branch-question.csv');
        });
    });

    describe('appendCSVRow', () => {
        const headers = 'col1,col2';
        const row = 'val1,val2';
        const formRef = 'form1';
        const branchRef = null;

        it('should write headers and append row when offset is 0 (Documents)', async () => {
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, row, formRef, 0, branchRef, Directory.Documents);

            expect(Filesystem.writeFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data:  '\uFEFF' + headers,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
                recursive: true
            });
            expect(Filesystem.appendFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data: '\r\n' + row,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
        });

        it('should write headers and append row when offset is 0 (Data)', async () => {
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, row, formRef, 0, branchRef, Directory.Data);

            expect(Filesystem.writeFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data:  '\uFEFF' + headers,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            expect(Filesystem.appendFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data: '\r\n' + row,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
        });

        it('should only append when offset is not 0', async () => {
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, row, formRef, 1, branchRef);

            expect(Filesystem.writeFile).not.toHaveBeenCalled();
            expect(Filesystem.appendFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data: '\r\n' + row,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
        });

        it('should not append if row is empty', async () => {
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, '', formRef, 1, branchRef);

            expect(Filesystem.writeFile).not.toHaveBeenCalled();
            expect(Filesystem.appendFile).not.toHaveBeenCalled();
        });

        it('should reject on writeFile error', async () => {
            const error = new Error('Write failed');
            Filesystem.writeFile.mockRejectedValue(error);
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await expect(writeFileService.appendCSVRow(headers, row, formRef, 0, branchRef))
                .rejects.toThrow(error);
        });

        it('should reject on appendFile error', async () => {
            const error = new Error('Append failed');
            Filesystem.appendFile.mockRejectedValue(error);
            vi.spyOn(writeFileService, 'getCSVFilePath').mockReturnValue('test.csv');

            await expect(writeFileService.appendCSVRow(headers, row, formRef, 1, branchRef))
                .rejects.toThrow(error);
        });
    });
});
