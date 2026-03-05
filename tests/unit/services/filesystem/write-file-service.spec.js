import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileService } from '@/services/filesystem/write-file-service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';

// Mock dependencies
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
        appendFile: vi.fn()
    },
    Directory: {
        Documents: 'Documents'
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
        // Reset mocks before each test
        vi.resetAllMocks();
    });

    describe('getFilePath', () => {
        it('should return correct file path for a form', () => {
            projectModel.getSlug.mockReturnValue('my-project');
            projectModel.getFormIndex.mockReturnValue(0);
            projectModel.getFormName.mockReturnValue('Test Form');
            utilsService.generateFilenameForExport.mockReturnValue('form-1_test-form');
            utilsService.getExportPath.mockReturnValue('/path/to/export/my-project');

            const path = writeFileService.getFilePath('form1', null);

            expect(projectModel.getSlug).toHaveBeenCalled();
            expect(projectModel.getFormIndex).toHaveBeenCalledWith('form1');
            expect(projectModel.getFormName).toHaveBeenCalledWith('form1');
            expect(utilsService.generateFilenameForExport).toHaveBeenCalledWith('form-1', 'Test Form');
            expect(utilsService.getExportPath).toHaveBeenCalledWith('my-project');
            expect(path).toBe('/path/to/export/my-project/data/form-1_test-form.csv');
        });

        it('should return correct file path for a branch', () => {
            projectModel.getSlug.mockReturnValue('my-project');
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
            utilsService.generateFilenameForExport.mockReturnValue('branch-1_branch-question');
            utilsService.getExportPath.mockReturnValue('/path/to/export/my-project');

            const path = writeFileService.getFilePath('form1', 'branch1');
            expect(path).toBe('/path/to/export/my-project/data/branch-1_branch-question.csv');
        });
    });

    describe('appendCSVRow', () => {
        const headers = 'col1,col2';
        const row = 'val1,val2';
        const formRef = 'form1';
        const branchRef = null;

        it('should write headers when offset is 0', async () => {
            vi.spyOn(writeFileService, 'getFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, row, formRef, 0, branchRef);

            expect(Filesystem.writeFile).toHaveBeenCalledWith({
                path: 'test.csv',
                data: headers,
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

        it('should only append when offset is not 0', async () => {
            vi.spyOn(writeFileService, 'getFilePath').mockReturnValue('test.csv');

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
            vi.spyOn(writeFileService, 'getFilePath').mockReturnValue('test.csv');

            await writeFileService.appendCSVRow(headers, '', formRef, 1, branchRef);

            expect(Filesystem.writeFile).not.toHaveBeenCalled();
            expect(Filesystem.appendFile).not.toHaveBeenCalled();
        });

        it('should reject on writeFile error', async () => {
            const error = new Error('Write failed');
            Filesystem.writeFile.mockRejectedValue(error);
            vi.spyOn(writeFileService, 'getFilePath').mockReturnValue('test.csv');

            await expect(writeFileService.appendCSVRow(headers, row, formRef, 0, branchRef))
                .rejects.toThrow(error);
        });

        it('should reject on appendFile error', async () => {
            const error = new Error('Append failed');
            Filesystem.appendFile.mockRejectedValue(error);
            vi.spyOn(writeFileService, 'getFilePath').mockReturnValue('test.csv');

            await expect(writeFileService.appendCSVRow(headers, row, formRef, 1, branchRef))
                .rejects.toThrow(error);
        });
    });
});
