import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { Filesystem } from '@capacitor/filesystem';
import { getBase64FromFilePath } from '@capgo/camera-preview';
import { resizePhotoService } from '@/services/filesystem/resize-photo-service';
import { useRootStore } from '@/stores/root-store';

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: { writeFile: vi.fn() }
}));

vi.mock('@capgo/camera-preview', () => ({
    getBase64FromFilePath: vi.fn()
}));

function mockBitmap(width, height) {
    return {
        width,
        height,
        close: vi.fn()
    };
}

function mockCanvas() {
    const drawImage = vi.fn();
    const toBlob = vi.fn((cb) => cb(new Blob(['jpegbytes'], { type: 'image/jpeg' })));
    const getContext = vi.fn(() => ({ drawImage }));
    return {
        canvas: {
            width: 0,
            height: 0,
            getContext,
            toBlob
        },
        drawImage,
        toBlob,
        getContext
    };
}

describe('resizePhotoService', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.tempDir = '/tmp/';
    });

    describe('_targetDimensions', () => {
        it('returns 1024x768 for a landscape source', () => {
            expect(resizePhotoService._targetDimensions(4032, 3024)).toEqual({ width: 1024, height: 768 });
        });

        it('returns 768x1024 for a portrait source', () => {
            expect(resizePhotoService._targetDimensions(3024, 4032)).toEqual({ width: 768, height: 1024 });
        });

        it('returns 1024x1024 for a square source', () => {
            expect(resizePhotoService._targetDimensions(1024, 1024)).toEqual({ width: 1024, height: 1024 });
        });
    });

    describe('_coverCropParams', () => {
        it('centers a 4:3 source into 1024x768', () => {
            const params = resizePhotoService._coverCropParams(4032, 3024, 1024, 768);
            expect(params.drawWidth).toBeCloseTo(1024, 5);
            expect(params.drawHeight).toBeCloseTo(768, 5);
            expect(params.offsetX).toBeCloseTo(0, 5);
            expect(params.offsetY).toBeCloseTo(0, 5);
        });

        it('crops a portrait 3:4 source to 1024x768', () => {
            const params = resizePhotoService._coverCropParams(3024, 4032, 1024, 768);
            // scale = max(1024/3024, 768/4032) = 1024/3024 ≈ 0.3386
            expect(params.drawWidth).toBeCloseTo(1024, 5);
            expect(params.drawHeight).toBeCloseTo(1365.33, 2);
            expect(params.offsetX).toBeCloseTo(0, 5);
            expect(params.offsetY).toBeCloseTo((768 - 1365.33) / 2, 1);
        });

        it('covers a 16:9 source into 1024x768 without distortion', () => {
            const params = resizePhotoService._coverCropParams(3840, 2160, 1024, 768);
            const scale = Math.max(1024 / 3840, 768 / 2160);
            expect(params.drawWidth).toBeCloseTo(3840 * scale, 5);
            expect(params.drawHeight).toBeCloseTo(2160 * scale, 5);
            expect(params.offsetX).toBeCloseTo((1024 - 3840 * scale) / 2, 5);
            expect(params.offsetY).toBeCloseTo((768 - 2160 * scale) / 2, 5);
        });
    });

    describe('resizeToTempDir', () => {
        it('writes the cover-cropped JPEG to rootStore.tempDir + filename', async () => {
            const { canvas, drawImage, toBlob } = mockCanvas();
            const originalCreateElement = document.createElement;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return canvas;
                }
                return originalCreateElement.call(document, tag);
            });

            // mock createImageBitmap on the global scope
            const originalCreateImageBitmap = globalThis.createImageBitmap;
            globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap(4032, 3024));

            getBase64FromFilePath.mockResolvedValue('BASE64DATA');

            // mock FileReader to read a blob back as a data URL string
            const originalFileReader = globalThis.FileReader;
            class MockFileReader {
                constructor() {
                    this.onloadend = null;
                    this.onerror = null;
                }
                readAsDataURL(_blob) {
                    this.result = 'data:image/jpeg;base64,READBASE64';
                    if (this.onloadend) {
                        this.onloadend();
                    }
                }
            }
            globalThis.FileReader = MockFileReader;

            try {
                const result = await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');

                expect(result).toBe('photo.jpg');
                expect(globalThis.createImageBitmap).toHaveBeenCalledWith(
                    expect.anything(),
                    { imageOrientation: 'from-image' }
                );
                expect(canvas.width).toBe(1024);
                expect(canvas.height).toBe(768);
                expect(drawImage).toHaveBeenCalledTimes(1);
                expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
                expect(Filesystem.writeFile).toHaveBeenCalledWith({
                    path: '/tmp/photo.jpg',
                    data: 'READBASE64',
                    recursive: true
                });
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('sizes the canvas to 768x1024 for a portrait source (matching native flow)', async () => {
            const { canvas, drawImage } = mockCanvas();
            const originalCreateElement = document.createElement;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return canvas;
                }
                return originalCreateElement.call(document, tag);
            });

            const originalCreateImageBitmap = globalThis.createImageBitmap;
            globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap(3024, 4032));
            getBase64FromFilePath.mockResolvedValue('BASE64DATA');

            const originalFileReader = globalThis.FileReader;
            class MockFileReader {
                constructor() {
                    this.onloadend = null;
                    this.onerror = null;
                }
                readAsDataURL(_blob) {
                    this.result = 'data:image/jpeg;base64,READBASE64';
                    if (this.onloadend) {
                        this.onloadend();
                    }
                }
            }
            globalThis.FileReader = MockFileReader;

            try {
                const result = await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');

                expect(result).toBe('photo.jpg');
                expect(canvas.width).toBe(768);
                expect(canvas.height).toBe(1024);
                expect(drawImage).toHaveBeenCalledTimes(1);
                expect(Filesystem.writeFile).toHaveBeenCalledWith({
                    path: '/tmp/photo.jpg',
                    data: 'READBASE64',
                    recursive: true
                });
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('writes to the temp dir without a directory scope when tempDir is a file:// URI', async () => {
            const rootStore = useRootStore();
            rootStore.tempDir = 'file:///data/user/0/uk.ac.imperial.epicollect.five/files/temp/';

            const { canvas } = mockCanvas();
            const originalCreateElement = document.createElement;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return canvas;
                }
                return originalCreateElement.call(document, tag);
            });

            const originalCreateImageBitmap = globalThis.createImageBitmap;
            globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap(4032, 3024));
            getBase64FromFilePath.mockResolvedValue('BASE64DATA');

            const originalFileReader = globalThis.FileReader;
            class MockFileReader {
                constructor() {
                    this.onloadend = null;
                    this.onerror = null;
                }
                readAsDataURL(_blob) {
                    this.result = 'data:image/jpeg;base64,READBASE64';
                    if (this.onloadend) {
                        this.onloadend();
                    }
                }
            }
            globalThis.FileReader = MockFileReader;

            try {
                await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');

                //absolute file:// path must not be scoped to a directory (e.g. Cache),
                //otherwise the file lands in cache/file%3A/... and the temp file 404s
                expect(Filesystem.writeFile).toHaveBeenCalledWith({
                    path: 'file:///data/user/0/uk.ac.imperial.epicollect.five/files/temp/photo.jpg',
                    data: 'READBASE64',
                    recursive: true
                });
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('propagates errors from createImageBitmap', async () => {
            const { canvas } = mockCanvas();
            const originalCreateElement = document.createElement;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return canvas;
                }
                return originalCreateElement.call(document, tag);
            });

            const originalCreateImageBitmap = globalThis.createImageBitmap;
            globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'));

            getBase64FromFilePath.mockResolvedValue('BASE64DATA');

            try {
                await expect(resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg'))
                    .rejects.toThrow('decode failed');
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
            }
        });
    });
});
