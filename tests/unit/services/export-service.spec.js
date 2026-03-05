import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '@/services/export-service';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import {utilsService} from '@/services/utilities/utils-service';

// Mock dependencies
vi.mock('@/stores/root-store');
vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        APP_NAME: 'Epicollect5'
    }
}));

describe('exportService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getExportPath', () => {
        it('should return the correct path for Android', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: PARAMETERS.ANDROID
                }
            });

            const projectSlug = 'my-project-slug';
            const expectedPath = `${PARAMETERS.APP_NAME}/${projectSlug}`;
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });

        it('should return the correct path for iOS (or other platforms)', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: 'ios'
                }
            });

            const projectSlug = 'my-project-slug';
            const expectedPath = projectSlug;
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });

        it('should handle projectSlug with leading/trailing slashes', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: PARAMETERS.ANDROID
                }
            });

            const projectSlug = '/my-project-slug/';
            const expectedPath = `${PARAMETERS.APP_NAME}/my-project-slug`;
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });

        it('should handle projectSlug with leading/trailing slashes for iOS', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: 'ios'
                }
            });

            const projectSlug = '/my-project-slug/';
            const expectedPath = 'my-project-slug';
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });

        it('should return an empty string if projectSlug is empty', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: PARAMETERS.ANDROID
                }
            });

            const projectSlug = '';
            const expectedPath = `${PARAMETERS.APP_NAME}/`;
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });

        it('should return an empty string if projectSlug is empty for iOS', () => {
            useRootStore.mockReturnValue({
                device: {
                    platform: 'ios'
                }
            });

            const projectSlug = '';
            const expectedPath = '';
            const result = utilsService.getExportPath(projectSlug);

            expect(result).toBe(expectedPath);
            expect(useRootStore).toHaveBeenCalled();
        });
    });
});
