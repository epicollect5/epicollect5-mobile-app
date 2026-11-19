import {describe, it, expect} from 'vitest';
import {utilsService} from '@/services/utilities/utils-service';

describe('getDropzoneRejectionMessage', () => {
    it('scopes file-too-large to the per-type limit', () => {
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-too-large', message: 'File is larger than 5000000 bytes'},
            'photo',
            'Unknown error'
        )).toBe('max file size 5 MB');
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-too-large', message: 'File is larger than 10000000 bytes'},
            'audio',
            'Unknown error'
        )).toBe('max file size 10 MB');
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-too-large', message: 'File is larger than 25000000 bytes'},
            'video',
            'Unknown error'
        )).toBe('max file size 25 MB');
    });

    it('scopes file-invalid-type to the per-type formats', () => {
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-invalid-type', message: 'File type must be image/jpeg, image/jpg, image/png'},
            'photo',
            'Unknown error'
        )).toBe('jpg or png only');
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-invalid-type', message: 'File type must be audio/mp4, audio/wav, video/mp4'},
            'audio',
            'Unknown error'
        )).toBe('mp4 or wav only');
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'file-invalid-type', message: 'File type must be video/mp4'},
            'video',
            'Unknown error'
        )).toBe('mp4 only');
    });

    it('passes through other rejection messages unchanged', () => {
        expect(utilsService.getDropzoneRejectionMessage(
            {code: 'too-many-files', message: 'Too many files'},
            'photo',
            'Unknown error'
        )).toBe('Too many files');
    });

    it('falls back when no rejection is present', () => {
        expect(utilsService.getDropzoneRejectionMessage(
            undefined,
            'photo',
            'Unknown error'
        )).toBe('Unknown error');
    });
});
