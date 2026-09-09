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

        it('returns 1024x768 for a square source (server rejects square)', () => {
            expect(resizePhotoService._targetDimensions(1024, 1024)).toEqual({ width: 1024, height: 768 });
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
                //the canvas is sized for the draw, then released after export
                expect(drawImage).toHaveBeenCalledTimes(1);
                expect(canvas.width).toBe(0);
                expect(canvas.height).toBe(0);
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
                //the canvas is sized for the draw (768x1024 portrait), then
                //released after export
                expect(canvas.width).toBe(0);
                expect(canvas.height).toBe(0);
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

        it('closes the bitmap and releases the canvas on success', async () => {
            const bitmap = mockBitmap(4032, 3024);
            const { canvas, drawImage } = mockCanvas();
            const originalCreateElement = document.createElement;
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return canvas;
                }
                return originalCreateElement.call(document, tag);
            });

            const originalCreateImageBitmap = globalThis.createImageBitmap;
            globalThis.createImageBitmap = vi.fn().mockResolvedValue(bitmap);
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
                expect(bitmap.close).toHaveBeenCalledTimes(1);
                expect(drawImage).toHaveBeenCalledTimes(1);
                expect(canvas.width).toBe(0);
                expect(canvas.height).toBe(0);
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('attaches failure context without changing the original error', async () => {
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
                await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');
                expect.unreachable();
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe('decode failed');
                expect(error.resizeContext).toMatchObject({
                    stage: 'decode',
                    base64Length: 'BASE64DATA'.length,
                    heap: undefined
                });
                expect(error.resizeContext.sourceWidth).toBeUndefined();
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('attaches the heap snapshot when performance.memory is available', async () => {
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

            const perf = globalThis.performance;
            const hadMemory = perf && Object.prototype.hasOwnProperty.call(perf, 'memory');
            const previousMemory = perf ? perf.memory : undefined;
            if (perf) {
                Object.defineProperty(perf, 'memory', {
                    value: { usedJSHeapSize: 123456, jsHeapSizeLimit: 536870912 },
                    configurable: true
                });
            }

            try {
                await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');
                expect.unreachable();
            } catch (error) {
                expect(error.resizeContext.heap).toEqual({ used: 123456, limit: 536870912 });
            } finally {
                if (perf) {
                    if (hadMemory) {
                        Object.defineProperty(perf, 'memory', { value: previousMemory, configurable: true });
                    } else {
                        delete perf.memory;
                    }
                }
                globalThis.createImageBitmap = originalCreateImageBitmap;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('propagates non-object rejections unchanged', async () => {
            getBase64FromFilePath.mockRejectedValue('plain string failure');

            await expect(resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg'))
                .rejects.toBe('plain string failure');
        });
    });
});
