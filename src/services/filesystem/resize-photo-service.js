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

    async resizeToTempDir(sourcePath, filename) {
        const rootStore = useRootStore();
        const tempDir = rootStore.tempDir;

        const base64 = await getBase64FromFilePath(sourcePath);
        const blob = await fetch(`data:image/jpeg;base64,${base64}`).then((r) => r.blob());

        // Android 10+ / iOS 16+ both support createImageBitmap + imageOrientation: 'from-image'
        // which bakes EXIF orientation into the decoded bitmap dimensions.
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });

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

        ctx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
        bitmap.close && bitmap.close();

        const resizedBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => {
                if (!b) {
                    reject(new Error('Canvas toBlob returned null'));
                    return;
                }
                resolve(b);
            }, 'image/jpeg', JPEG_QUALITY);
        });

        const resizedBase64 = await _blobToBase64(resizedBlob);

        //rootStore.tempDir is an absolute file:// URI (e.g. files/temp/ on Android). Do NOT
        //pass a directory here: the Filesystem plugin would treat the full URI as a path
        //relative to that directory (writing into cache/file%3A/...) instead of the temp dir.
        //Without a directory, the plugin resolves the file:// URI to the absolute temp path.
        await Filesystem.writeFile({
            path: tempDir + filename,
            data: resizedBase64,
            recursive: true
        });

        return filename;
    }
};
