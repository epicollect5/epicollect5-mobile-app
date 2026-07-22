import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/web-service', () => ({
    webService: {
        getHeaders: vi.fn(),
        getProjectImageUrl: vi.fn(() => 'http://test/logo.jpg')
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        WEB: 'web',
        ANDROID: 'android',
        LOGOS_DIR: '/logos/'
    }
}));

import { projectLogoService } from '@/services/project-logo-service';
import { useRootStore } from '@/stores/root-store';

describe('projectLogoService', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('_getColorFromName', () => {
        it('returns a palette color for a normal name', () => {
            const color = projectLogoService._getColorFromName('My Project');
            expect(projectLogoService.palette).toContain(color);
        });

        it('returns a palette color for an empty string (defensive)', () => {
            const color = projectLogoService._getColorFromName('');
            expect(projectLogoService.palette).toContain(color);
            expect(color).toBeDefined();
        });

        it('returns a palette color for whitespace-only input', () => {
            const color = projectLogoService._getColorFromName('   ');
            expect(projectLogoService.palette).toContain(color);
            expect(color).toBeDefined();
        });

        it('returns a palette color for a single character', () => {
            const color = projectLogoService._getColorFromName('A');
            expect(projectLogoService.palette).toContain(color);
        });

        it('is deterministic (same input -> same output)', () => {
            const a = projectLogoService._getColorFromName('Foo Bar');
            const b = projectLogoService._getColorFromName('Foo Bar');
            expect(a).toBe(b);
        });

        it('never returns undefined (hash >>> 0 fix)', () => {
            // Iterate a wide range of names; the hash >>> 0 fix ensures
            // the index is always in [0, palette.length-1]
            const inputs = [
                '', 'a', 'A', 'hello', 'Hello World',
                '1234567890', '!@#$%^&*()', '\u0000\u0001\u0002',
                'a'.repeat(100)
            ];
            for (const input of inputs) {
                const color = projectLogoService._getColorFromName(input);
                expect(color).toBeDefined();
                expect(projectLogoService.palette).toContain(color);
            }
        });

        it('covers all 25 palette entries across varied inputs', () => {
            // Sanity check that the hash distribution is non-degenerate
            const seen = new Set();
            for (let i = 0; i < 100; i++) {
                seen.add(projectLogoService._getColorFromName(`name-${i}`));
            }
            expect(seen.size).toBeGreaterThan(1);
        });
    });

    describe('generateLocally - initials (defensive)', () => {
        let originalCreateElement;
        let mockToBlob;
        let mockCtx;
        let mockFileWriter;
        let mockFileEntry;
        let mockDirEntry;
        let originalDevice;

        beforeEach(() => {
            const rootStore = useRootStore();
            rootStore.device = {platform: 'android'};
            rootStore.persistentDir = '/mock/';

            originalCreateElement = document.createElement.bind(document);
            originalDevice = rootStore.device;

            mockCtx = {
                fillStyle: '',
                font: '',
                textAlign: '',
                textBaseline: '',
                fillRect: vi.fn(),
                fillText: vi.fn()
            };

            mockToBlob = vi.fn();
            let toBlobCallback;
            mockToBlob.mockImplementation((cb) => {
                toBlobCallback = cb;
                // Simulate a successful blob by default
                setTimeout(() => cb(new Blob(['x'], {type: 'image/jpeg'})), 0);
            });

            document.createElement = vi.fn((tag) => {
                if (tag === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: () => mockCtx,
                        toBlob: mockToBlob
                    };
                }
                return originalCreateElement(tag);
            });

            // Mock document.fonts.load to resolve immediately
            if (!document.fonts) {
                document.fonts = {load: vi.fn(() => Promise.resolve())};
            } else {
                document.fonts.load = vi.fn(() => Promise.resolve());
            }

            // Mock the file system chain
            mockDirEntry = {
                getDirectory: vi.fn((name, opts, cb) => cb({getFile: mockFileEntry_getFile}))
            };
            function mockFileEntry_getFile(name, opts, cb) {
                mockFileEntry = {
                    toURL: () => 'file:///mock/logos/abc/mobile-logo.jpg',
                    createWriter: vi.fn((cb) => cb({
                        onwriteend: null,
                        onerror: null,
                        write: function (blob) {
                            if (this.onwriteend) this.onwriteend();
                        }
                    }))
                };
                cb(mockFileEntry);
            }
            window.resolveLocalFileSystemURL = vi.fn((url, cb) => cb({
                getDirectory: mockDirEntry.getDirectory
            }));
        });

        afterEach(() => {
            document.createElement = originalCreateElement;
            if (originalDevice) {
                const rootStore = useRootStore();
                rootStore.device = originalDevice;
            }
        });

        it('uses "?" as initials for an empty project name (defensive fallback)', async () => {
            await projectLogoService.generateLocally('', 'project-ref');

            // The fallback "?" becomes "?" after .toUpperCase()
            expect(mockCtx.fillText).toHaveBeenCalledWith('?', 64, 64);
        });

        it('uses "?" as initials for null project name (defensive fallback)', async () => {
            await projectLogoService.generateLocally(null, 'project-ref');

            expect(mockCtx.fillText).toHaveBeenCalledWith('?', 64, 64);
        });

        it('uses "?" as initials for undefined project name (defensive fallback)', async () => {
            await projectLogoService.generateLocally(undefined, 'project-ref');

            expect(mockCtx.fillText).toHaveBeenCalledWith('?', 64, 64);
        });

        it('uses "?" as initials for whitespace-only project name', async () => {
            await projectLogoService.generateLocally('   ', 'project-ref');

            expect(mockCtx.fillText).toHaveBeenCalledWith('?', 64, 64);
        });

        it('uses first two characters for a single-word name', async () => {
            await projectLogoService.generateLocally('hello', 'project-ref');

            expect(mockCtx.fillText).toHaveBeenCalledWith('HE', 64, 64);
        });

        it('uses first letter of first two words for a multi-word name', async () => {
            await projectLogoService.generateLocally('Hello World', 'project-ref');

            expect(mockCtx.fillText).toHaveBeenCalledWith('HW', 64, 64);
        });
    });

    describe('generateLocally - toBlob hang fix', () => {
        let originalCreateElement;

        beforeEach(() => {
            const rootStore = useRootStore();
            rootStore.device = {platform: 'android'};
            rootStore.persistentDir = '/mock/';

            originalCreateElement = document.createElement.bind(document);
            document.createElement = vi.fn((tag) => {
                if (tag === 'canvas') {
                    return {
                        width: 0,
                        height: 0,
                        getContext: () => ({
                            fillStyle: '',
                            font: '',
                            textAlign: '',
                            textBaseline: '',
                            fillRect: vi.fn(),
                            fillText: vi.fn()
                        }),
                        // Simulate toBlob callback with null (failed conversion)
                        toBlob: vi.fn((cb) => {
                            setTimeout(() => cb(null), 0);
                        })
                    };
                }
                return originalCreateElement(tag);
            });

            document.fonts = {load: vi.fn(() => Promise.resolve())};
        });

        afterEach(() => {
            document.createElement = originalCreateElement;
        });

        it('rejects when canvas.toBlob returns null (e.g. tainted canvas)', async () => {
            await expect(
                projectLogoService.generateLocally('Test', 'project-ref')
            ).rejects.toThrow(/toBlob returned null/);
        });
    });
});
