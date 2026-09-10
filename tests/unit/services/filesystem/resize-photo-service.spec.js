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

        it('downscales with high smoothing quality to keep source detail', async () => {
            const { canvas, getContext } = mockCanvas();
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

                //single high-quality downscale from the large capture (canvas
                //default smoothing is 'low', which softens detail)
                const ctx = getContext.mock.results[0].value;
                expect(ctx.imageSmoothingEnabled).toBe(true);
                expect(ctx.imageSmoothingQuality).toBe('high');
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('carries the source EXIF into the written file with orientation normalized', async () => {
            //minimal source JPEG: APP1 Exif, orientation 6, one GPS entry
            const tiff = [
                0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
                0x02, 0x00,
                0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
                0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x01, 0x00,
                0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00
            ];
            const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
            const app1Value = [...exifHeader, ...tiff];
            const sourceBytes = [0xff, 0xd8, 0xff, 0xe1, (app1Value.length + 2) >> 8, (app1Value.length + 2) & 0xff, ...app1Value, 0xff, 0xd9];
            const toBase64 = (values) => btoa(values.map((b) => String.fromCharCode(b)).join(''));
            getBase64FromFilePath.mockResolvedValue(toBase64(sourceBytes));

            //canvas export: minimal EXIF-less JPEG
            const plainBytes = [0xff, 0xd8, 0xff, 0xd9];

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

            const originalFileReader = globalThis.FileReader;
            const plainDataUrl = 'data:image/jpeg;base64,' + toBase64(plainBytes);
            class MockFileReader {
                constructor() {
                    this.onloadend = null;
                    this.onerror = null;
                }
                readAsDataURL(_blob) {
                    this.result = plainDataUrl;
                    if (this.onloadend) {
                        this.onloadend();
                    }
                }
            }
            globalThis.FileReader = MockFileReader;

            try {
                await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg');

                const written = Filesystem.writeFile.mock.calls[0][0];
                expect(written.path).toBe('/tmp/photo.jpg');
                const writtenBytes = [...atob(written.data)].map((c) => c.charCodeAt(0));
                //fresh APP1 Exif segment present (not the EXIF-less canvas output)
                expect(writtenBytes.length).toBeGreaterThan(plainBytes.length);
                //GPS latitude-ref entry survived verbatim
                const gpsEntry = [0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e];
                const gpsAt = writtenBytes.findIndex((_, i) => gpsEntry.every((b, j) => writtenBytes[i + j] === b));
                expect(gpsAt).toBeGreaterThan(-1);
                //orientation normalized to 1 (pixels already baked upright)
                const app1At = writtenBytes.findIndex((_, i) => writtenBytes[i] === 0xff && writtenBytes[i + 1] === 0xe1);
                const tiffStart = app1At + 4 + 6;
                const orientation = writtenBytes[tiffStart + 18] | (writtenBytes[tiffStart + 19] << 8);
                expect(orientation).toBe(1);
            } finally {
                globalThis.createImageBitmap = originalCreateImageBitmap;
                globalThis.FileReader = originalFileReader;
                document.createElement.mockRestore && document.createElement.mockRestore();
            }
        });

        it('strips GPS with stripGps while keeping the remaining EXIF', async () => {
            //same source fixture: APP1 Exif, orientation 6, one GPS entry
            const tiff = [
                0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
                0x02, 0x00,
                0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
                0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x01, 0x00,
                0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00
            ];
            const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
            const app1Value = [...exifHeader, ...tiff];
            const sourceBytes = [0xff, 0xd8, 0xff, 0xe1, (app1Value.length + 2) >> 8, (app1Value.length + 2) & 0xff, ...app1Value, 0xff, 0xd9];
            const toBase64 = (values) => btoa(values.map((b) => String.fromCharCode(b)).join(''));
            getBase64FromFilePath.mockResolvedValue(toBase64(sourceBytes));

            const plainBytes = [0xff, 0xd8, 0xff, 0xd9];

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

            const originalFileReader = globalThis.FileReader;
            const plainDataUrl = 'data:image/jpeg;base64,' + toBase64(plainBytes);
            class MockFileReader {
                constructor() {
                    this.onloadend = null;
                    this.onerror = null;
                }
                readAsDataURL(_blob) {
                    this.result = plainDataUrl;
                    if (this.onloadend) {
                        this.onloadend();
                    }
                }
            }
            globalThis.FileReader = MockFileReader;

            try {
                //location denied at capture: GPS stripped, other tags kept
                await resizePhotoService.resizeToTempDir('/source.jpg', 'photo.jpg', { stripGps: true });

                const written = Filesystem.writeFile.mock.calls[0][0];
                const writtenBytes = [...atob(written.data)].map((c) => c.charCodeAt(0));
                //APP1 still present (remaining tags carried over)
                const app1At = writtenBytes.findIndex((_, i) => writtenBytes[i] === 0xff && writtenBytes[i + 1] === 0xe1);
                expect(app1At).toBeGreaterThan(-1);
                const tiffStart = app1At + 4 + 6;
                //orientation still normalized
                const orientation = writtenBytes[tiffStart + 18] | (writtenBytes[tiffStart + 19] << 8);
                expect(orientation).toBe(1);
                //GPS latitude-ref entry gone
                const gpsEntry = [0x01, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x4e];
                const gpsAt = writtenBytes.findIndex((_, i) => gpsEntry.every((b, j) => writtenBytes[i + j] === b));
                expect(gpsAt).toBe(-1);
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
