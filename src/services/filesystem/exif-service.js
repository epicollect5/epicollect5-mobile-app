//Minimal EXIF segment copier: carries the source capture's EXIF (GPS included)
//into the canvas-generated output JPEG, which otherwise ships EXIF-less
//(native system-camera parity). Best-effort by contract: any missing or
//malformed structure returns the output untouched, never throws, so a photo
//can never fail on EXIF handling.

const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;
const JPEG_APP1 = 0xe1;
const TIFF_LITTLE_ENDIAN = 0x4949;
const TIFF_BIG_ENDIAN = 0x4d4d;
const TIFF_MAGIC = 42;
const TAG_ORIENTATION = 0x0112;
const TAG_GPS_INFO = 0x8825;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;

function _base64ToBytes(base64) {
    //strip a data-url prefix when present, matching utils-service b64toBlob
    const clean = String(base64).includes(',') ? String(base64).split(',')[1] : String(base64);
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function _bytesToBase64(bytes) {
    //stringify in chunks: a single apply on megabyte arrays blows the stack
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

//locate the APP1 Exif segment value ([start, end) past its length field),
//scanning segment headers before SOS only: entropy data is never parsed, so
//malformed files cannot confuse the scan. Returns null when absent/invalid
function _findExifSegment(bytes) {
    if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) {
        return null;
    }
    let pos = 2;
    while (pos < bytes.length) {
        const segmentStart = pos;
        //tolerate fill bytes preceding the marker
        while (pos < bytes.length && bytes[pos] === 0xff) {
            pos++;
        }
        if (pos >= bytes.length) {
            return null;
        }
        const marker = bytes[pos];
        pos++;
        if (marker === JPEG_EOI || marker === JPEG_SOS) {
            return null;
        }
        //standalone markers carry no length field
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === JPEG_SOI) {
            continue;
        }
        if (pos + 1 >= bytes.length) {
            return null;
        }
        const length = (bytes[pos] << 8) | bytes[pos + 1];
        if (length < 2 || pos + length > bytes.length) {
            return null;
        }
        if (marker === JPEG_APP1
            && length >= 8
            && bytes[pos + 2] === 0x45 //E
            && bytes[pos + 3] === 0x78 //x
            && bytes[pos + 4] === 0x69 //i
            && bytes[pos + 5] === 0x66 //f
            && bytes[pos + 6] === 0x00
            && bytes[pos + 7] === 0x00) {
            return { start: pos + 2, end: pos + length };
        }
        pos += length;
    }
    return null;
}

//normalize the copied segment on a copy: orientation to 1 (the resize
//pipeline already baked it into the pixels; keeping e.g. 6 would
//double-rotate portrait shots) and IFD1 offset to 0 (drops the stale embedded
//thumbnail depicting the pre-resize source). All other tags incl. GPS copy
//verbatim, so internal IFD offsets stay valid. With stripGps the GPS directory
//is additionally zeroed in place (location denied: no GPS in the output, every
//other tag kept). Returns null when corrupt
function _normalizedExifCopy(bytes, segment, stripGps) {
    const copy = bytes.slice(segment.start, segment.end);
    if (copy.length < 14) {
        return null;
    }
    const view = new DataView(copy.buffer, copy.byteOffset, copy.length);
    const tiffStart = 6;
    const byteOrder = view.getUint16(tiffStart, false);
    const littleEndian = byteOrder === TIFF_LITTLE_ENDIAN;
    if (byteOrder !== TIFF_LITTLE_ENDIAN && byteOrder !== TIFF_BIG_ENDIAN) {
        return null;
    }
    if (view.getUint16(tiffStart + 2, littleEndian) !== TIFF_MAGIC) {
        return null;
    }
    const ifd0 = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
    if (ifd0 + 2 > copy.length) {
        return null;
    }
    const count = view.getUint16(ifd0, littleEndian);
    if (ifd0 + 2 + count * 12 + 4 > copy.length) {
        return null;
    }
    for (let i = 0; i < count; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (view.getUint16(entry, littleEndian) !== TAG_ORIENTATION) {
            continue;
        }
        const type = view.getUint16(entry + 2, littleEndian);
        const tagCount = view.getUint32(entry + 4, littleEndian);
        if (type === TYPE_SHORT && tagCount === 1) {
            view.setUint16(entry + 8, 1, littleEndian);
        } else if (type === TYPE_LONG && tagCount === 1) {
            view.setUint32(entry + 8, 1, littleEndian);
        }
    }
    view.setUint32(ifd0 + 2 + count * 12, 0, littleEndian);
    if (stripGps && !_stripGpsDirectory(view, copy, ifd0, count, littleEndian)) {
        return null;
    }
    return copy;
}

//zero the GPS directory in place (count + entries): parsers see an empty GPS
//IFD while every other tag and offset stays valid. Orphaned rational bytes
//become unreferenced dead weight. Returns false when the pointer is malformed
function _stripGpsDirectory(view, copy, ifd0, count, littleEndian) {
    const ifdEnd = ifd0 + 2 + count * 12 + 4;
    for (let i = 0; i < count; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (view.getUint16(entry, littleEndian) !== TAG_GPS_INFO) {
            continue;
        }
        if (view.getUint16(entry + 2, littleEndian) !== TYPE_LONG
            || view.getUint32(entry + 4, littleEndian) !== 1) {
            return false;
        }
        //offsets are relative to the TIFF start (6 bytes into the copy)
        const gpsIfd = 6 + view.getUint32(entry + 8, littleEndian);
        //the directory must sit after IFD0 itself, never overlapping it:
        //anything else is corrupt
        if (gpsIfd < ifdEnd) {
            return false;
        }
        if (gpsIfd + 2 > copy.length) {
            return false;
        }
        const gpsCount = view.getUint16(gpsIfd, littleEndian);
        const gpsEnd = gpsIfd + 2 + gpsCount * 12 + 4;
        if (gpsEnd > copy.length) {
            return false;
        }
        copy.fill(0, gpsIfd, gpsEnd);
        return true;
    }
    //no GPS pointer: nothing to strip
    return true;
}

//the output minus any stale APP1 Exif segments (canvas emits none today, but
//a future encoder might): every other segment and the post-SOS payload copy
//verbatim. Returns null when the output is not a parseable JPEG
function _stripExifSegments(bytes) {
    if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) {
        return null;
    }
    const parts = [bytes.subarray(0, 2)];
    let pos = 2;
    while (pos < bytes.length) {
        const segmentStart = pos;
        while (pos < bytes.length && bytes[pos] === 0xff) {
            pos++;
        }
        if (pos >= bytes.length) {
            return null;
        }
        const marker = bytes[pos];
        pos++;
        if (marker === JPEG_EOI || marker === JPEG_SOS) {
            //payload to end of file copies verbatim, entropy data never parsed
            parts.push(bytes.subarray(segmentStart));
            break;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === JPEG_SOI) {
            parts.push(bytes.subarray(segmentStart, pos));
            continue;
        }
        if (pos + 1 >= bytes.length) {
            return null;
        }
        const length = (bytes[pos] << 8) | bytes[pos + 1];
        if (length < 2 || pos + length > bytes.length) {
            return null;
        }
        const isStaleExif = marker === JPEG_APP1
            && length >= 8
            && bytes[pos + 2] === 0x45
            && bytes[pos + 3] === 0x78
            && bytes[pos + 4] === 0x69
            && bytes[pos + 5] === 0x66
            && bytes[pos + 6] === 0x00
            && bytes[pos + 7] === 0x00;
        if (!isStaleExif) {
            parts.push(bytes.subarray(segmentStart, pos + length));
        }
        pos += length;
    }
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const stripped = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
        stripped.set(part, offset);
        offset += part.length;
    });
    return stripped;
}

function _copyExifSegmentOrThrow(sourceBase64, outputBase64, stripGps) {
    const sourceBytes = _base64ToBytes(sourceBase64);
    const segment = _findExifSegment(sourceBytes);
    //no EXIF to carry (or not a JPEG): keep the output as generated
    if (!segment) {
        return outputBase64;
    }
    const exif = _normalizedExifCopy(sourceBytes, segment, stripGps);
    //corrupt EXIF structure: skip the copy rather than risk a broken file
    //(the length field is 2 bytes, so a found segment always fits back)
    if (!exif) {
        return outputBase64;
    }
    const outputBytes = _base64ToBytes(outputBase64);
    const stripped = _stripExifSegments(outputBytes);
    if (!stripped) {
        return outputBase64;
    }
    const merged = new Uint8Array(2 + 2 + 2 + exif.length + stripped.length - 2);
    merged[0] = 0xff;
    merged[1] = JPEG_SOI;
    merged[2] = 0xff;
    merged[3] = JPEG_APP1;
    merged[4] = (exif.length + 2) >> 8;
    merged[5] = (exif.length + 2) & 0xff;
    merged.set(exif, 6);
    merged.set(stripped.subarray(2), 6 + exif.length);
    return _bytesToBase64(merged);
}

export const exifService = {
    //best-effort by contract: any missing or malformed structure returns the
    //output untouched, never throws, so a photo can never fail on EXIF handling.
    //With stripGps (location denied) the GPS directory is zeroed in place while
    //every other tag is kept; granted captures keep lat/long untouched
    copyExifSegment(sourceBase64, outputBase64, options) {
        try {
            const stripGps = !!options && options.stripGps === true;
            return _copyExifSegmentOrThrow(sourceBase64, outputBase64, stripGps);
        } catch (error) {
            console.log('exif copy skipped: ' + error);
            return outputBase64;
        }
    }
};
