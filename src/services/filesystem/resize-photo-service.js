import { Filesystem } from '@capacitor/filesystem';
import { getBase64FromFilePath } from '@capgo/camera-preview';
import { useRootStore } from '@/stores/root-store';

const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 768;
const JPEG_QUALITY = 0.85;

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

    async resizeToTempDir(sourcePath, filename) {
        const rootStore = useRootStore();
        const tempDir = rootStore.tempDir;

        const base64 = await getBase64FromFilePath(sourcePath);
        const blob = await fetch(`data:image/jpeg;base64,${base64}`).then((r) => r.blob());

        // Android 10+ / iOS 16+ both support createImageBitmap + imageOrientation: 'from-image'
        // which bakes EXIF orientation into the decoded bitmap dimensions.
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });

        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d');

        const { drawWidth, drawHeight, offsetX, offsetY } = _coverCropParams(
            bitmap.width,
            bitmap.height,
            TARGET_WIDTH,
            TARGET_HEIGHT
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
