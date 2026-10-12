import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';

//Fixed instant: 2026-06-15T12:00:00Z (June avoids DST transitions in both zones)
const NOON_UTC = '2026-06-15T12:00:00.000Z';
//+14, no DST: local date is 2026-06-16
const FAR_EAST = 'Pacific/Kiritimati';
//-5 in June (CDT), no transition nearby: local date stays 2026-06-15
const FAR_WEST = 'America/Chicago';

const realTZ = process.env.TZ;

function setTZ(timezone) {
    process.env.TZ = timezone;
}

describe('utils-service timezone handling', () => {
    beforeEach(() => {
        setTZ(FAR_EAST);
    });

    afterEach(() => {
        process.env.TZ = realTZ;
    });

    it('renders the local wall time per timezone for the same instant', () => {
        setTZ(FAR_EAST);
        expect(utilsService.toISOStringLocale(new Date(NOON_UTC))).toBe('2026-06-16T02:00:00.000');

        setTZ(FAR_WEST);
        expect(utilsService.toISOStringLocale(new Date(NOON_UTC))).toBe('2026-06-15T07:00:00.000');
    });

    it('persists the local calendar date across the date line', () => {
        setTZ(FAR_EAST);
        expect(utilsService.getISODateOnly(utilsService.toISOStringLocale(new Date(NOON_UTC)))).toBe('2026-06-16T00:00:00.000');

        setTZ(FAR_WEST);
        expect(utilsService.getISODateOnly(utilsService.toISOStringLocale(new Date(NOON_UTC)))).toBe('2026-06-15T00:00:00.000');
    });

    it('preserves wall-clock time regardless of timezone', () => {
        //local constructor evaluated under each timezone in turn
        setTZ(FAR_EAST);
        expect(utilsService.getISOTime(new Date(2026, 5, 15, 14, 30, 5))).toBe('2026-06-15T14:30:05.000');

        setTZ(FAR_WEST);
        expect(utilsService.getISOTime(new Date(2026, 5, 15, 14, 30, 5))).toBe('2026-06-15T14:30:05.000');
    });

    it('formats display strings timezone-independently', () => {
        for (const timezone of [FAR_EAST, FAR_WEST]) {
            setTZ(timezone);
            expect(utilsService.getUserFormattedDate('2026-10-09T00:00:00.000', PARAMETERS.DATE_FORMAT_1)).toBe('09/10/2026');
            expect(utilsService.getUserFormattedTime('2026-10-09T14:30:05.000', PARAMETERS.TIME_FORMAT_3)).toBe('14:30');
        }
    });
});
