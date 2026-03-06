import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS, DEMO_PROJECT } from '@/config';
import { Capacitor } from '@capacitor/core';
import { projectModel } from '@/models/project-model.js';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(),
        convertFileSrc: vi.fn((path) => `capacitor://file//${path}`)
    }
}));

// Mock project model
vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectName: vi.fn(),
        getSlug: vi.fn(),
        getProjectRef: vi.fn()
    }
}));

// Mock stores
vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn()
}));

describe('utilsService.getProjectNameMarkup()', () => {
    let mockRootStore;
    let utilsService;

    beforeEach(async () => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        // Import after pinia is set up
        const module = await import('@/services/utilities/utils-service');
        utilsService = module.utilsService;

        // Setup default mock for root store
        mockRootStore = {
            serverUrl: 'https://epicollect.co/',
            persistentDir: '/data/user/0/app/files/',
            device: { platform: PARAMETERS.WEB }
        };
        useRootStore.mockReturnValue(mockRootStore);

        // Setup default project model mocks
        projectModel.getProjectName.mockReturnValue('Test Project');
        projectModel.getSlug.mockReturnValue('test-project');
        projectModel.getProjectRef.mockReturnValue('test123');
    });

    describe('PWA / Web Platform', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(false);
            mockRootStore.serverUrl = 'https://epicollect.co/';
        });

        it('should return img markup with project name when hideName is false', () => {
            projectModel.getProjectName.mockReturnValue('My Project');
            projectModel.getSlug.mockReturnValue('my-project');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('<img');
            expect(result).toContain('class="project-logo"');
            expect(result).toContain('width="32"');
            expect(result).toContain('height="32"');
            expect(result).toContain('alt="My Project logo"');
            expect(result).toContain('my-project');
            expect(result).toContain('<span>&nbsp;MY PROJECT</span>');
        });

        it('should return img markup without project name when hideName is true', () => {
            projectModel.getProjectName.mockReturnValue('My Project');
            projectModel.getSlug.mockReturnValue('my-project');

            const result = utilsService.getProjectNameMarkup(true);

            expect(result).toContain('<img');
            expect(result).toContain('class="project-logo"');
            expect(result).toContain('my-project');
            expect(result).not.toContain('<span>');
        });

        it('should construct correct logo URL for PWA', () => {
            projectModel.getProjectName.mockReturnValue('Test');
            projectModel.getSlug.mockReturnValue('test-slug');
            mockRootStore.serverUrl = 'https://example.com/';

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('https://example.com/');
            expect(result).toContain('test-slug');
            expect(result).toContain(PARAMETERS.API.PARAMS.PROJECT_LOGO_QUERY_STRING);
        });

        it('should uppercase project name in span markup', () => {
            projectModel.getProjectName.mockReturnValue('lowercase project');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('LOWERCASE PROJECT');
        });

        it('should include alt text with project name', () => {
            projectModel.getProjectName.mockReturnValue('My Logo Project');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('alt="My Logo Project logo"');
        });
    });

    describe('Native Platform (Android & iOS)', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(true);
            mockRootStore.persistentDir = '/data/user/0/app/files/';
        });

        describe('Demo Project', () => {
            beforeEach(() => {
                projectModel.getProjectRef.mockReturnValue(DEMO_PROJECT.PROJECT_REF);
            });

            it('should use demo project fallback image', () => {
                projectModel.getProjectName.mockReturnValue('Demo');
                projectModel.getProjectRef.mockReturnValue(DEMO_PROJECT.PROJECT_REF);

                const result = utilsService.getProjectNameMarkup(false);

                expect(result).toContain('assets/images/ec5-demo-project-logo.jpg');
                expect(result).not.toContain('Capacitor.convertFileSrc');
            });

            it('should use base path for demo project (not convertFileSrc)', () => {
                const result = utilsService.getProjectNameMarkup(false);

                // For demo project, imgSrc should be basePath directly, not converted
                expect(result).toContain('/data/user/0/app/files/');
                expect(result).toContain(DEMO_PROJECT.PROJECT_REF);
                expect(result).toContain('mobile-logo.jpg');
            });

            it('should include onError fallback for demo project', () => {
                const result = utilsService.getProjectNameMarkup(false);

                expect(result).toContain('onError="this.src=\'assets/images/ec5-demo-project-logo.jpg\'"');
            });

            it('should include timestamp query string for cache busting', () => {
                vi.useFakeTimers();
                vi.setSystemTime(new Date('2026-03-06T10:00:00Z'));

                const result = utilsService.getProjectNameMarkup(false);

                expect(result).toMatch(/mobile-logo\.jpg\?\d+/);

                vi.useRealTimers();
            });
        });

        describe('Non-Demo Project', () => {
            beforeEach(() => {
                projectModel.getProjectRef.mockReturnValue('not-demo-123');
                Capacitor.convertFileSrc.mockReturnValue('capacitor://file///data/user/0/app/files/not-demo-123/mobile-logo.jpg?timestamp');
            });

            it('should use convertFileSrc for non-demo projects (WKWebView fix)', () => {
                projectModel.getProjectName.mockReturnValue('Real Project');

                const result = utilsService.getProjectNameMarkup(false);

                expect(Capacitor.convertFileSrc).toHaveBeenCalled();
                expect(result).toContain('capacitor://');
            });

            it('should use placeholder image as fallback for non-demo projects', () => {
                const result = utilsService.getProjectNameMarkup(false);

                expect(result).toContain('onError="this.src=\'assets/images/ec5-placeholder-100x100.jpg\'"');
                expect(result).not.toContain('ec5-demo-project-logo.jpg');
            });

            it('should construct proper file path with project ref', () => {
                projectModel.getProjectRef.mockReturnValue('project-abc-123');

                utilsService.getProjectNameMarkup(false);

                // Verify convertFileSrc was called with the project ref in the path
                expect(Capacitor.convertFileSrc).toHaveBeenCalledWith(
                    expect.stringContaining('project-abc-123')
                );
                expect(Capacitor.convertFileSrc).toHaveBeenCalledWith(
                    expect.stringContaining('mobile-logo.jpg')
                );
            });

            it('should include timestamp in path for cache busting', () => {
                vi.useFakeTimers();
                const now = new Date('2026-03-06T14:30:45Z').getTime();
                vi.setSystemTime(now);

                utilsService.getProjectNameMarkup(false);

                expect(Capacitor.convertFileSrc).toHaveBeenCalledWith(
                    expect.stringContaining(`?${now}`)
                );

                vi.useRealTimers();
            });

            it('should pass converted path to convertFileSrc', () => {
                projectModel.getProjectRef.mockReturnValue('myproject');
                mockRootStore.persistentDir = '/storage/emulated/0/';

                utilsService.getProjectNameMarkup(false);

                expect(Capacitor.convertFileSrc).toHaveBeenCalledWith(
                    expect.stringMatching(/\/storage\/emulated\/0\/.*myproject.*mobile-logo\.jpg/)
                );
            });
        });

        it('should return img markup with project name on native platform', () => {
            projectModel.getProjectName.mockReturnValue('Native App');
            projectModel.getProjectRef.mockReturnValue('native123');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('<img');
            expect(result).toContain('class="project-logo"');
            expect(result).toContain('width="32"');
            expect(result).toContain('height="32"');
            expect(result).toContain('alt="Native App logo"');
            expect(result).toContain('<span>&nbsp;NATIVE APP</span>');
        });

        it('should return img markup without project name on native platform when hideName is true', () => {
            projectModel.getProjectName.mockReturnValue('Native App');
            projectModel.getProjectRef.mockReturnValue('native123');

            const result = utilsService.getProjectNameMarkup(true);

            expect(result).toContain('<img');
            expect(result).not.toContain('<span>');
        });
    });

    describe('HTML Markup Structure', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(false);
        });

        it('should generate valid img tag with all required attributes', () => {
            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toMatch(/<img[^>]*class="project-logo"[^>]*>/);
            expect(result).toMatch(/width="32"/);
            expect(result).toMatch(/height="32"/);
            expect(result).toMatch(/alt="[^"]+"/);
        });

        it('should not include onError attribute when no fallback provided', () => {
            // PWA/Web platform doesn't use a fallback image
            Capacitor.isNativePlatform.mockReturnValue(false);

            const result = utilsService.getProjectNameMarkup(false);

            // PWA platform doesn't provide a fallback, so onError should NOT be present
            expect(result).not.toMatch(/onError/);
        });

        it('should properly escape quotes in onError handler', () => {
            projectModel.getProjectName.mockReturnValue('Test');
            Capacitor.isNativePlatform.mockReturnValue(true);
            projectModel.getProjectRef.mockReturnValue(DEMO_PROJECT.PROJECT_REF);

            const result = utilsService.getProjectNameMarkup(false);

            // Should use single quotes inside onError
            expect(result).toMatch(/onError="this\.src='[^']*'"/);
        });

        it('should combine img markup and name markup in correct order', () => {
            projectModel.getProjectName.mockReturnValue('MyProject');

            const result = utilsService.getProjectNameMarkup(false);

            const imgIndex = result.indexOf('<img');
            const spanIndex = result.indexOf('<span>');

            // img should come before span
            expect(imgIndex).toBeGreaterThan(-1);
            expect(spanIndex).toBeGreaterThan(-1);
            expect(imgIndex).toBeLessThan(spanIndex);
        });
    });

    describe('Edge Cases and Special Characters', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(false);
        });

        it('should handle project names with special characters', () => {
            projectModel.getProjectName.mockReturnValue('Project & Co.');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('alt="Project & Co. logo"');
            expect(result).toContain('PROJECT & CO.');
        });

        it('should handle project names with unicode characters', () => {
            projectModel.getProjectName.mockReturnValue('Проект');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('Проект');
            expect(result).toContain('ПРОЕКТ');
        });

        it('should handle empty project name', () => {
            projectModel.getProjectName.mockReturnValue('');

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('alt=" logo"');
            expect(result).toContain('<span>&nbsp;</span>');
        });

        it('should handle very long project names', () => {
            const longName = 'A'.repeat(500);
            projectModel.getProjectName.mockReturnValue(longName);

            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain(longName.toUpperCase());
        });

        it('should handle project names with HTML characters', () => {
            projectModel.getProjectName.mockReturnValue('Project <test>');

            const result = utilsService.getProjectNameMarkup(false);

            // These should be included as-is in the alt attribute (not escaped in this context)
            expect(result).toContain('Project <test>');
        });
    });

    describe('hideName Parameter', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(false);
            projectModel.getProjectName.mockReturnValue('Test Project');
        });

        it('should not include span when hideName is true', () => {
            const result = utilsService.getProjectNameMarkup(true);

            expect(result).not.toContain('<span>');
            expect(result).toContain('<img');
        });

        it('should include span when hideName is false', () => {
            const result = utilsService.getProjectNameMarkup(false);

            expect(result).toContain('<span>');
            expect(result).toContain('<img');
        });

        it('should include span when hideName is undefined (default falsy)', () => {
            const result = utilsService.getProjectNameMarkup();

            expect(result).toContain('<span>');
        });

        it('should include span when hideName is null (falsy value)', () => {
            const result = utilsService.getProjectNameMarkup(null);

            expect(result).toContain('<span>');
        });

        it('should not include span when hideName is truthy', () => {
            const result = utilsService.getProjectNameMarkup(1);

            expect(result).not.toContain('<span>');
        });
    });

    describe('Store and Model Integration', () => {
        it('should call useRootStore', () => {
            Capacitor.isNativePlatform.mockReturnValue(false);

            utilsService.getProjectNameMarkup(false);

            expect(useRootStore).toHaveBeenCalled();
        });

        it('should call projectModel.getProjectName', () => {
            Capacitor.isNativePlatform.mockReturnValue(false);

            utilsService.getProjectNameMarkup(false);

            expect(projectModel.getProjectName).toHaveBeenCalled();
        });

        it('should call projectModel.getSlug on PWA platform', () => {
            Capacitor.isNativePlatform.mockReturnValue(false);

            utilsService.getProjectNameMarkup(false);

            expect(projectModel.getSlug).toHaveBeenCalled();
        });

        it('should call projectModel.getProjectRef on native platform', () => {
            Capacitor.isNativePlatform.mockReturnValue(true);

            utilsService.getProjectNameMarkup(false);

            expect(projectModel.getProjectRef).toHaveBeenCalled();
        });

        it('should call Capacitor.isNativePlatform to determine platform', () => {
            utilsService.getProjectNameMarkup(false);

            expect(Capacitor.isNativePlatform).toHaveBeenCalled();
        });
    });

    describe('Return Type', () => {
        beforeEach(() => {
            Capacitor.isNativePlatform.mockReturnValue(false);
        });

        it('should return a string', () => {
            const result = utilsService.getProjectNameMarkup(false);

            expect(typeof result).toBe('string');
        });

        it('should return non-empty string', () => {
            const result = utilsService.getProjectNameMarkup(false);

            expect(result.length).toBeGreaterThan(0);
        });

        it('should always contain img tag', () => {
            const result1 = utilsService.getProjectNameMarkup(true);
            const result2 = utilsService.getProjectNameMarkup(false);

            expect(result1).toContain('<img');
            expect(result2).toContain('<img');
        });
    });
});

