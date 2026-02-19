import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { fakeAnswerService } from '@/services/entry/fake-answer-service';
import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';

// Mocks for external services
vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: { insertMedia: vi.fn(() => Promise.resolve('ok')) }
}));
vi.mock('@/services/filesystem/fake-file-photo-service', () => ({
    fakeFilePhotoService: { createFile: vi.fn(() => Promise.resolve('photo.jpg')) }
}));
vi.mock('@/services/filesystem/fake-file-audio-service', () => ({
    fakeFileAudioService: { createFile: vi.fn(() => Promise.resolve('audio.mp3')) }
}));
vi.mock('@/services/filesystem/fake-file-video-service', () => ({
    fakeFileVideoService: { createFile: vi.fn(() => Promise.resolve('video.mp4')) }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getRandomInRange: vi.fn((min, max) => (min + max) / 2), // Returns middle of range
        getRandomLocation: vi.fn((lat, long) => ({
            latitude: lat,
            longitude: long,
            accuracy: 10
        })),
        getRandomInt: vi.fn((max) => Math.floor(max / 2)),
        trunc: vi.fn((str, len) => str.substring(0, len))
    }
}));

describe('fakeAnswerService Coverage Suite', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const baseEntry = { entryUuid: 'uuid-123' };

    // --- TEXT & TEXTAREA ---
    describe('Text and Textarea', () => {
        it('covers text with regex and truncation', async () => {
            const input = { type: 'text', regex: '[A-Z]{300}', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(input, baseEntry, '1');
            expect(res.answer.length).toBe(255); // Truncation logic
            expect(res.answer).toMatch(/^[A-Z]+$/);
        });

        it('covers textarea without regex (random phrase)', async () => {
            const input = { type: 'textarea', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(input, baseEntry, '1');
            expect(typeof res.answer).toBe('string');
            // Verify sanitization of < >
            expect(res.answer).not.toContain('<');
            expect(res.answer).not.toContain('>');
        });
    });

    // --- NUMERIC TYPES ---
    describe('Numeric Types', () => {
        it('covers integer with min/max', async () => {
            const input = { type: 'integer', min: 50, max: 60, possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(input, baseEntry, '1');
            expect(res.answer).toBeGreaterThanOrEqual(50);
            expect(res.answer).toBeLessThanOrEqual(60);
        });

        it('covers phone with regex (digits only)', async () => {
            const input = { type: 'phone', regex: '99[0-9]{5}', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(input, baseEntry, '1');
            expect(res.answer).toMatch(/^99\d{5}$/);
        });

        it('covers decimal random range', async () => {
            const input = { type: 'decimal', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(input, baseEntry, '1');
            const val = parseFloat(res.answer);
            expect(val).toBeGreaterThanOrEqual(0.02);
            expect(val).toBeLessThanOrEqual(10.12);
        });
    });

    describe('Location and Temporal Types', () => {

        it('covers location generation with correct coordinate ranges', async () => {
            const inputDetails = { type: 'location', possible_answers: [] };

            // We don't need getMockMapper, just use the imported mock
            await fakeAnswerService.createFakeAnswer(inputDetails, {}, '1');

            // Verify logic was called with the specific "Mirko" ranges
            expect(utilsService.getRandomInRange).toHaveBeenCalledWith(-80, 80, 5);
            expect(utilsService.getRandomInRange).toHaveBeenCalledWith(-160, 160, 5);
        });

        it('covers date generation as a valid ISO string', async () => {
            const inputDetails = { type: 'date', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(inputDetails, {}, '1');

            // Check if it's a valid ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            expect(res.answer).toMatch(isoRegex);

            // Ensure it's a valid date
            expect(new Date(res.answer).getTime()).not.toBeNaN();
        });

        it('covers time generation using the same temporal logic', async () => {
            const inputDetails = { type: 'time', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(inputDetails, {}, '1');

            // Even though it's type 'time', your code uses randomDate()
            // which returns a full ISO string.
            expect(typeof res.answer).toBe('string');
            expect(new Date(res.answer).getTime()).not.toBeNaN();
        });
    });

    // --- SELECTION TYPES ---
    describe('Selection Types', () => {
        const choices = {
            possible_answers: [{ answer_ref: 'a' }, { answer_ref: 'b' }]
        };

        it('covers radio/dropdown (single string)', async () => {
            const res = await fakeAnswerService.createFakeAnswer({ type: 'radio', ...choices }, baseEntry, '1');
            expect(['a', 'b']).toContain(res.answer);
        });

        it('covers checkbox/searchmultiple (array)', async () => {
            const res = await fakeAnswerService.createFakeAnswer({ type: 'checkbox', ...choices }, baseEntry, '1');
            expect(Array.isArray(res.answer)).toBe(true);
            expect(['a', 'b']).toContain(res.answer[0]);
        });
    });

    // --- SPECIAL TYPES ---
    describe('Special Types', () => {
        it('covers barcode generation', async () => {
            const res = await fakeAnswerService.createFakeAnswer({ type: 'barcode', possible_answers: [] }, baseEntry, '1');
            expect(res.answer).toMatch(/^[a-z0-9-]+$/);
        });

        it('covers location generation', async () => {
            const res = await fakeAnswerService.createFakeAnswer({ type: 'location', possible_answers: [] }, baseEntry, '1');
            expect(res.answer).toHaveProperty('latitude');
            expect(res.answer).toHaveProperty('longitude');
        });

        it('covers date and time', async () => {
            const resDate = await fakeAnswerService.createFakeAnswer({ type: 'date', possible_answers: [] }, baseEntry, '1');
            const resTime = await fakeAnswerService.createFakeAnswer({ type: 'time', possible_answers: [] }, baseEntry, '1');
            expect(new Date(resDate.answer).getTime()).not.toBeNaN();
            expect(new Date(resTime.answer).getTime()).not.toBeNaN();
        });

        it('generates a date that is in the past', async () => {
            const inputDetails = { type: 'date', possible_answers: [] };
            const res = await fakeAnswerService.createFakeAnswer(inputDetails, {}, '1');

            const generatedDate = new Date(res.answer);
            const now = new Date();

            expect(generatedDate.getTime()).toBeLessThanOrEqual(now.getTime());
        });
    });

    // --- MEDIA TYPES (PLATFORM BRANCHING) ---
    describe('Media Branching', () => {
        it('handles photo on Android (Mobile Branch)', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };

            const promise = fakeAnswerService.createFakeAnswer({ type: 'photo', possible_answers: [] }, baseEntry, '1');
            vi.advanceTimersByTime(1000);

            const res = await promise;
            expect(res.answer).toBe('photo.jpg');
        });

        it('handles audio on Web (Web Branch)', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'web' };

            const res = await fakeAnswerService.createFakeAnswer({ type: 'audio', possible_answers: [] }, baseEntry, '1');
            expect(res.answer).toBe('');
        });
    });
});
