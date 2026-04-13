import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';

// Mock Capacitor Filesystem
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        readFile: vi.fn()
    }
}));

// Mock Config
vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        IOS: 'ios',
        WEB: 'web'
    }
}));

describe('Android File Intent Service', () => {
    let androidFileIntentService;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Dynamic import to ensure it uses the mocks
        const module = await import('@/services/android-file-intent-service');
        androidFileIntentService = module.androidFileIntentService;
    });

    describe('isJsonFileIntent()', () => {
        describe('Android platform checks', () => {
            it('returns false if platform is not Android', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///path/file.json', 'ios')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('file:///path/file.json', 'web')).toBe(false);
            });

            it('returns false if url is null or undefined', () => {
                expect(androidFileIntentService.isJsonFileIntent(null, 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent(undefined, 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('', 'android')).toBe(false);
            });
        });

        describe('file:// URI handling', () => {
            it('returns true for file:// URLs ending with .json', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project.json', 'android')).toBe(true);
                expect(androidFileIntentService.isJsonFileIntent('file:///data/projects/config.json', 'android')).toBe(true);
            });

            it('returns true for file:// URLs with .JSON in uppercase', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/PROJECT.JSON', 'android')).toBe(true);
            });

            it('returns true for file:// URLs with mixed case .Json', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project.Json', 'android')).toBe(true);
            });

            it('returns false for file:// URLs not ending with .json', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project.txt', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project.pdf', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project', 'android')).toBe(false);
            });

            it('returns false for file:// URLs with .json in the middle of filename', () => {
                expect(androidFileIntentService.isJsonFileIntent('file:///storage/emulated/0/project.json.backup', 'android')).toBe(false);
            });
        });

        describe('content:// URI handling', () => {
            it('returns true for content:// URIs (media files from file manager)', () => {
                expect(androidFileIntentService.isJsonFileIntent('content://media/external/file/15025', 'android')).toBe(true);
                expect(androidFileIntentService.isJsonFileIntent('content://com.android.providers.media.documents/document/image%3A15025', 'android')).toBe(true);
            });

            it('returns true for any content:// URI regardless of filename', () => {
                expect(androidFileIntentService.isJsonFileIntent('content://media/external/file/12345', 'android')).toBe(true);
            });
        });

        describe('http/https URL handling', () => {
            it('returns false for http:// URLs - allowing them to flow through to URL routing', () => {
                expect(androidFileIntentService.isJsonFileIntent('http://example.com/project.json', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('http://example.com/api/data', 'android')).toBe(false);
            });

            it('returns false for https:// URLs - allowing them to flow through to URL routing', () => {
                expect(androidFileIntentService.isJsonFileIntent('https://example.com/project.json', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('https://five.epicollect.net/open/project/123', 'android')).toBe(false);
            });

            it('allows https deep links to flow through to be handled by appUrlOpen listener', () => {
                // When a user opens an https link, isJsonFileIntent should return false
                // so the appUrlOpen listener can handle it with normal URL routing logic
                const deepLink = 'https://five.epicollect.net/open/project/abc123';
                const result = androidFileIntentService.isJsonFileIntent(deepLink, 'android');

                expect(result).toBe(false);
                // This means the control flow continues to the next part of appUrlOpen
            });

            it('allows http URLs to flow through to be handled by appUrlOpen listener', () => {
                // When a user opens an http link, isJsonFileIntent should return false
                // so the appUrlOpen listener can handle it with normal URL routing logic
                const link = 'http://example.com/some/path';
                const result = androidFileIntentService.isJsonFileIntent(link, 'android');

                expect(result).toBe(false);
                // This means the control flow continues to the next part of appUrlOpen
            });
        });

        describe('other schemes', () => {
            it('returns false for other URI schemes', () => {
                expect(androidFileIntentService.isJsonFileIntent('ftp://example.com/file.json', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('data://example.com/file.json', 'android')).toBe(false);
                expect(androidFileIntentService.isJsonFileIntent('mailto:test@example.com', 'android')).toBe(false);
            });
        });
    });

    describe('extractJsonFromIntent()', () => {
        const mockJsonData = { name: 'test project', description: 'test description' };
        const mockJsonString = JSON.stringify(mockJsonData);

        describe('file:// URI handling', () => {
            it('reads and parses JSON from file:// URL', async () => {
                Filesystem.readFile.mockResolvedValue({ data: mockJsonString });

                const result = await androidFileIntentService.extractJsonFromIntent('file:///storage/emulated/0/project.json');

                expect(result).toEqual(mockJsonData);
                expect(Filesystem.readFile).toHaveBeenCalledWith({
                    path: '/storage/emulated/0/project.json',
                    encoding: 'utf8'
                });
            });

            it('throws error when file cannot be read from file:// URL', async () => {
                Filesystem.readFile.mockRejectedValue(new Error('File not found'));

                await expect(
                    androidFileIntentService.extractJsonFromIntent('file:///storage/emulated/0/nonexistent.json')
                ).rejects.toThrow('Failed to read or parse JSON file: File not found');
            });

            it('throws error when JSON is invalid in file:// URL', async () => {
                Filesystem.readFile.mockResolvedValue({ data: 'invalid json {' });

                await expect(
                    androidFileIntentService.extractJsonFromIntent('file:///storage/emulated/0/project.json')
                ).rejects.toThrow('Failed to read or parse JSON file');
            });
        });

        describe('content:// URI handling', () => {
            it('reads and parses JSON from content:// URI', async () => {
                Filesystem.readFile.mockResolvedValue({ data: mockJsonString });

                const result = await androidFileIntentService.extractJsonFromIntent('content://media/external/file/15025');

                expect(result).toEqual(mockJsonData);
                expect(Filesystem.readFile).toHaveBeenCalledWith({
                    path: 'content://media/external/file/15025',
                    encoding: 'utf8'
                });
            });

            it('throws error when file cannot be read from content:// URI', async () => {
                Filesystem.readFile.mockRejectedValue(new Error('Permission denied'));

                await expect(
                    androidFileIntentService.extractJsonFromIntent('content://media/external/file/15025')
                ).rejects.toThrow('Failed to read or parse JSON file: Permission denied');
            });

            it('throws error when JSON is invalid in content:// URI', async () => {
                Filesystem.readFile.mockResolvedValue({ data: '{invalid json}' });

                await expect(
                    androidFileIntentService.extractJsonFromIntent('content://media/external/file/15025')
                ).rejects.toThrow('Failed to read or parse JSON file');
            });
        });

        describe('edge cases', () => {
            it('handles empty JSON object', async () => {
                Filesystem.readFile.mockResolvedValue({ data: '{}' });

                const result = await androidFileIntentService.extractJsonFromIntent('file:///path/empty.json');

                expect(result).toEqual({});
            });

            it('handles JSON array', async () => {
                const arrayData = [{ id: 1 }, { id: 2 }];
                Filesystem.readFile.mockResolvedValue({ data: JSON.stringify(arrayData) });

                const result = await androidFileIntentService.extractJsonFromIntent('file:///path/array.json');

                expect(result).toEqual(arrayData);
            });

            it('handles complex nested JSON structure', async () => {
                const complexData = {
                    project: {
                        forms: [
                            { name: 'form1', questions: [{ id: 1 }, { id: 2 }] }
                        ],
                        settings: {
                            private: true,
                            description: 'test project'
                        }
                    }
                };
                Filesystem.readFile.mockResolvedValue({ data: JSON.stringify(complexData) });

                const result = await androidFileIntentService.extractJsonFromIntent('content://media/external/file/12345');

                expect(result).toEqual(complexData);
            });

            it('logs error to console when JSON parsing fails', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                Filesystem.readFile.mockResolvedValue({ data: 'invalid' });

                try {
                    await androidFileIntentService.extractJsonFromIntent('file:///path/invalid.json');
                } catch (error) {
                    // Expected error
                }

                expect(consoleErrorSpy).toHaveBeenCalled();
                consoleErrorSpy.mockRestore();
            });
        });
    });
});

