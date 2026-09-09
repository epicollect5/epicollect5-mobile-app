import { Filesystem } from '@capacitor/filesystem';
import { getBase64FromFilePath } from '@capgo/camera-preview';
import { useRootStore } from '@/stores/root-store';

const TARGET_LONG = 1024;
const TARGET_SHORT = 768;
const JPEG_QUALITY = 0.85;

//Output matches the native system-camera flow (1024 bounding box preserving
//aspect ratio): landscape captures become 1024x768, portrait captures become
//768x1024. Orientation is read from the decoded bitmap dimensions (EXIF baked
//in via imageOrientation: 'from-image'), not from the viewfinder: the native
//preview runs with lockAndroidOrientation so the viewfinder never rotates,
//but the capture file still carries the sensor orientation.
function _targetDimensions(sourceWidth, sourceHeight) {
    if (sourceHeight > sourceWidth) {
        return { width: TARGET_SHORT, height: TARGET_LONG };
    }
    //landscape and square both map to 1024x768: the server only accepts
    //1024x768 landscape or 768x1024 portrait, never square
    return { width: TARGET_LONG, height: TARGET_SHORT };
}

function _coverCropParams(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (targetWidth - drawWidth) / 2;
    const offsetY = (targetHeight - drawHeight) / 2;
    return { drawWidth, drawHeight, offsetX, offsetY };
}

function _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to read blob as base64'));
                return;
            }
            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export const resizePhotoService = {

    _coverCropParams,
    _targetDimensions,

    //Best-effort heap snapshot for failure diagnostics (Rollbar context only,
    //never branching logic): performance.memory exists on Chromium-based
    //runtimes (Android WebView included) and is absent elsewhere, where this
    //returns undefined and the context simply omits heap numbers
    _heapSnapshot() {
        try {
            const memory = typeof performance !== 'undefined' ? performance.memory : undefined;
            if (!memory || typeof memory.usedJSHeapSize !== 'number' || typeof memory.jsHeapSizeLimit !== 'number') {
                return undefined;
            }
            return { used: memory.usedJSHeapSize, limit: memory.jsHeapSizeLimit };
        } catch (error) {
            return undefined;
        }
    },

    async resizeToTempDir(sourcePath, filename) {
        const rootStore = useRootStore();
        const tempDir = rootStore.tempDir;

        //failure diagnostics only: the stage being attempted, source dimensions
        //(once decoded) and input size, attached to the propagating error so
        //Rollbar can separate memory-class failures from generic ones. The
        //original error is mutated and rethrown (never wrapped) to preserve
        //its type and message for existing callers and tests
        let stage = 'getBase64';
        let sourceWidth;
        let sourceHeight;
        let base64Length = 0;

        try {
            let base64 = await getBase64FromFilePath(sourcePath);
            base64Length = typeof base64 === 'string' ? base64.length : 0;
            stage = 'decode';
            let blob = await fetch(`data:image/jpeg;base64,${base64}`).then((r) => r.blob());

            // Android 10+ / iOS 16+ both support createImageBitmap + imageOrientation: 'from-image'
            // which bakes EXIF orientation into the decoded bitmap dimensions.
            const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
            sourceWidth = bitmap.width;
            sourceHeight = bitmap.height;

            //release the large source-side allocations as soon as the bitmap
            //is decoded; they are unreferenced from here on
            base64 = null;
            blob = null;

            const { width: targetWidth, height: targetHeight } = _targetDimensions(bitmap.width, bitmap.height);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            const { drawWidth, drawHeight, offsetX, offsetY } = _coverCropParams(
                bitmap.width,
                bitmap.height,
                targetWidth,
                targetHeight
            );

            stage = 'draw';
            ctx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
            bitmap.close && bitmap.close();

            stage = 'export';
            const resizedBlob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (!b) {
                        reject(new Error('Canvas toBlob returned null'));
                        return;
                    }
                    resolve(b);
                }, 'image/jpeg', JPEG_QUALITY);
            });

            //the canvas backing store is no longer needed once the output blob
            //exists: resetting dimensions releases it
            canvas.width = 0;
            canvas.height = 0;

            stage = 'encode';
            const resizedBase64 = await _blobToBase64(resizedBlob);

            //rootStore.tempDir is an absolute file:// URI (e.g. files/temp/ on Android). Do NOT
            //pass a directory here: the Filesystem plugin would treat the full URI as a path
            //relative to that directory (writing into cache/file%3A/...) instead of the temp dir.
            //Without a directory, the plugin resolves the file:// URI to the absolute temp path.
            stage = 'write';
            await Filesystem.writeFile({
                path: tempDir + filename,
                data: resizedBase64,
                recursive: true
            });

            return filename;
        } catch (error) {
            //plugin/Capacitor rejections are not always Error instances, and
            //assigning properties on primitives throws in strict-mode modules
            if (error && (typeof error === 'object' || typeof error === 'function')) {
                error.resizeContext = {
                    stage,
                    sourceWidth,
                    sourceHeight,
                    base64Length,
                    heap: resizePhotoService._heapSnapshot()
                };
            }
            throw error;
        }
    }
};
