import { describe, it, expect } from 'vitest';
import { exifService } from '@/services/filesystem/exif-service';

//in-test JPEG builders: hand-rolled minimal files, no binary fixtures

function encodeBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

//builds a minimal TIFF with an orientation entry, an optional GPS IFD with
//two inline entries, and an optional thumbnail IFD. Returns the TIFF bytes
//plus the offsets the assertions need (relative to the TIFF start)
function buildTiff({ orientation = 6, orientationType = 3, withGps = true, withThumbnail = false, bigEndian = false } = {}) {
    const le = !bigEndian;
    const bytes = [];
    const pushU16 = (v) => {
        bytes.push(le ? v & 0xff : (v >> 8) & 0xff, le ? (v >> 8) & 0xff : v & 0xff);
    };
    const pushU32 = (v) => {
        const ordered = le ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]
            : [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
        bytes.push(...ordered);
    };
    const pushBytes = (values) => {
        bytes.push(...values);
    };

    //byte order + magic + IFD0 offset
    pushBytes(bigEndian ? [0x4d, 0x4d, 0x00, 0x2a] : [0x49, 0x49, 0x2a, 0x00]);
    pushU32(8);

    const entryCount = withGps ? 2 : 1;
    const ifd0 = 8;
    const gpsOffset = ifd0 + 2 + entryCount * 12 + 4;
    pushU16(entryCount);

    //orientation entry (value inline)
    const orientationValueAt = bytes.length + 8;
    pushU16(0x0112);
    pushU16(orientationType);
    pushU32(1);
    if (orientationType === 3) {
        pushU16(orientation);
        pushU16(0);
    } else {
        pushU32(orientation);
    }

    let gpsEntryAt = -1;
    if (withGps) {
        //GPS pointer entry (offset relative to the TIFF start)
        gpsEntryAt = bytes.length + 8;
        pushU16(0x8825);
        pushU16(4);
        pushU32(1);
        pushU32(gpsOffset);
    }

    //IFD0 next-offset: thumbnail directory follows, else zero
    const nextIfdAt = bytes.length;
    const thumbnailOffset = withGps ? gpsOffset + 2 + 2 * 12 + 4 : gpsOffset;
    pushU32(withThumbnail ? thumbnailOffset : 0);

    if (withGps) {
        //GPS IFD: version (inline) + latitude ref 'N' (inline), next = 0
        pushU16(2);
        pushU16(0x0000);
        pushU16(1);
        pushU32(4);
        pushBytes([2, 3, 0, 0]);
        pushU16(0x0001);
        pushU16(2);
        pushU32(2);
        pushBytes([0x4e, 0x00, 0x00, 0x00]);
        pushU32(0);
    }

    if (withThumbnail) {
        //stale thumbnail directory: must be dropped by the copy
        pushU16(1);
        pushU16(0x0100);
        pushU16(3);
        pushU32(1);
        pushBytes([1, 0, 0, 0]);
        pushU32(0);
    }

    return {
        tiff: new Uint8Array(bytes),
        orientationValueAt,
        nextIfdAt,
        //GPS pointer entry through the end of the GPS IFD: must copy verbatim
        gpsBlockStart: withGps ? gpsEntryAt - 8 : -1,
        gpsBlockEnd: withGps ? thumbnailOffset : -1,
        //TIFF-relative offset of the GPS IFD itself (for strip assertions)
        gpsIfdAt: withGps ? gpsOffset : -1
    };
}

function app1Segment(tiff) {
    const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
    const value = new Uint8Array(header.length + tiff.length);
    value.set(header, 0);
    value.set(tiff, header.length);
    return value;
}

function buildJpeg({ app1Values = [], app0 = false, comment = false } = {}) {
    const bytes = [0xff, 0xd8];
    if (app0) {
        const payload = [0x4a, 0x46, 0x49, 0x46, 0x00];
        bytes.push(0xff, 0xe0, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload);
    }
    app1Values.forEach((value) => {
        bytes.push(0xff, 0xe1, (value.length + 2) >> 8, (value.length + 2) & 0xff, ...value);
    });
    if (comment) {
        const payload = [0x43, 0x4f, 0x4d];
        bytes.push(0xff, 0xfe, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload);
    }
    bytes.push(0xff, 0xd9);
    return new Uint8Array(bytes);
}

//locate the APP1 Exif value in a result file for byte-level assertions
function findApp1(bytes) {
    for (let i = 0; i + 9 < bytes.length; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xe1
            && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78
            && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
            const length = (bytes[i + 2] << 8) | bytes[i + 3];
            return { valueStart: i + 4, valueEnd: i + 2 + length, headerAt: i };
        }
    }
    return null;
}

function countApp1(bytes) {
    let count = 0;
    for (let i = 0; i + 3 < bytes.length; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
            count++;
        }
    }
    return count;
}

describe('exifService', () => {

    describe('copyExifSegment', () => {
        it('copies GPS verbatim, normalizes orientation to 1 and drops the thumbnail IFD', () => {
            const { tiff, orientationValueAt, nextIfdAt, gpsBlockStart, gpsBlockEnd } = buildTiff({ orientation: 6, withGps: true, withThumbnail: true });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            const result = decodeBase64(exifService.copyExifSegment(source, output));
            const app1 = findApp1(result);
            expect(app1).not.toBe(null);

            //TIFF starts after the 6-byte Exif header
            const tiffStart = app1.valueStart + 6;
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            //orientation baked into the pixels already: must read 1, not 6
            expect(view.getUint16(tiffStart + orientationValueAt, true)).toBe(1);
            //stale thumbnail directory dropped
            expect(view.getUint32(tiffStart + nextIfdAt, true)).toBe(0);
            //GPS pointer entry through the GPS IFD copied verbatim (skipping
            //the IFD0 next-offset, which is zeroed to drop the thumbnail)
            for (let i = gpsBlockStart; i < gpsBlockEnd; i++) {
                if (i >= nextIfdAt && i < nextIfdAt + 4) {
                    continue;
                }
                expect(result[tiffStart + i]).toBe(tiff[i]);
            }
        });

        it('normalizes a LONG-typed orientation tag too', () => {
            const { tiff, orientationValueAt } = buildTiff({ orientation: 6, orientationType: 4, withGps: false });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            const result = decodeBase64(exifService.copyExifSegment(source, output));
            const app1 = findApp1(result);
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            expect(view.getUint32(app1.valueStart + 6 + orientationValueAt, true)).toBe(1);
        });

        it('handles big-endian sources', () => {
            const { tiff, orientationValueAt } = buildTiff({ orientation: 6, withGps: false, bigEndian: true });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            const result = decodeBase64(exifService.copyExifSegment(source, output));
            const app1 = findApp1(result);
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            expect(view.getUint16(app1.valueStart + 6 + orientationValueAt, false)).toBe(1);
        });

        it('returns the output untouched when the source has no EXIF', () => {
            const source = encodeBase64(buildJpeg({}));
            const output = encodeBase64(buildJpeg({}));

            expect(exifService.copyExifSegment(source, output)).toBe(output);
        });

        it('returns the output untouched for corrupt sources without throwing', () => {
            const output = encodeBase64(buildJpeg({}));
            //not a JPEG at all
            expect(exifService.copyExifSegment('AAAA', output)).toBe(output);
            //truncated APP1 (length runs past end of file)
            const truncated = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
            expect(exifService.copyExifSegment(encodeBase64(truncated), output)).toBe(output);
            //APP1 without the Exif header
            expect(exifService.copyExifSegment(encodeBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x41, 0x42, 0x43, 0x44, 0xff, 0xd9])), output)).toBe(output);
            //bad TIFF magic
            const { tiff } = buildTiff({ withGps: false });
            tiff[2] = 0x00;
            tiff[3] = 0x00;
            const badMagic = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            expect(exifService.copyExifSegment(badMagic, output)).toBe(output);
        });

        it('returns the output untouched when the output is not a JPEG', () => {
            const { tiff } = buildTiff({ withGps: true });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));

            expect(exifService.copyExifSegment(source, 'AAAA')).toBe('AAAA');
        });

        it('replaces a stale output APP1 and preserves APP0 and COM segments', () => {
            const { tiff } = buildTiff({ orientation: 6, withGps: true });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const staleTiff = buildTiff({ orientation: 1, withGps: false }).tiff;
            const output = encodeBase64(buildJpeg({ app0: true, app1Values: [app1Segment(staleTiff)], comment: true }));

            const result = decodeBase64(exifService.copyExifSegment(source, output));
            //exactly one APP1 (the fresh copy), APP0 and COM preserved
            expect(countApp1(result)).toBe(1);
            const app1 = findApp1(result);
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            expect(view.getUint16(app1.valueStart + 6 + buildTiff({}).orientationValueAt, true)).toBe(1);
            //APP0 JFIF marker still present
            let hasApp0 = false;
            let hasCom = false;
            for (let i = 0; i + 1 < result.length; i++) {
                if (result[i] === 0xff && result[i + 1] === 0xe0) {
                    hasApp0 = true;
                }
                if (result[i] === 0xff && result[i + 1] === 0xfe) {
                    hasCom = true;
                }
            }
            expect(hasApp0).toBe(true);
            expect(hasCom).toBe(true);
        });

        it('zeroes the GPS directory with stripGps while keeping every other tag', () => {
            const { tiff, orientationValueAt, gpsBlockStart, gpsBlockEnd, gpsIfdAt } = buildTiff({ orientation: 6, withGps: true, withThumbnail: true });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            const result = decodeBase64(exifService.copyExifSegment(source, output, { stripGps: true }));
            const app1 = findApp1(result);
            expect(app1).not.toBe(null);

            const tiffStart = app1.valueStart + 6;
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            //orientation still normalized, thumbnail still dropped
            expect(view.getUint16(tiffStart + orientationValueAt, true)).toBe(1);
            //GPS directory zeroed in place: count reads 0, entries gone
            expect(view.getUint16(tiffStart + gpsIfdAt, true)).toBe(0);
            for (let i = gpsIfdAt; i < gpsBlockEnd; i++) {
                expect(result[tiffStart + i]).toBe(0);
            }
            //GPS pointer entry itself untouched (still points at the zeroed IFD)
            for (let i = gpsBlockStart; i < gpsBlockStart + 12; i++) {
                expect(result[tiffStart + i]).toBe(tiff[i]);
            }
            //no latitude ref survives anywhere in the file
            expect(result.includes(0x4e)).toBe(false);
        });

        it('copies normally with stripGps when the source has no GPS pointer', () => {
            const { tiff, orientationValueAt } = buildTiff({ orientation: 6, withGps: false });
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            const result = decodeBase64(exifService.copyExifSegment(source, output, { stripGps: true }));
            const app1 = findApp1(result);
            const view = new DataView(result.buffer, result.byteOffset, result.length);
            expect(view.getUint16(app1.valueStart + 6 + orientationValueAt, true)).toBe(1);
        });

        it('returns the output untouched when the GPS pointer is malformed', () => {
            const built = buildTiff({ orientation: 6, withGps: true });
            const tiff = built.tiff;
            //corrupt the GPS pointer offset to run past the segment end
            const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.length);
            view.setUint32(built.gpsBlockStart + 8, 0xffffff, true);
            const source = encodeBase64(buildJpeg({ app1Values: [app1Segment(tiff)] }));
            const output = encodeBase64(buildJpeg({}));

            expect(exifService.copyExifSegment(source, output, { stripGps: true })).toBe(output);
        });
    });
});
