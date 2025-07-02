const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

export const isValidCoordsService = {
    getCoords(param1, param2) {
        // Handle string format: 'lat, lng'
        if (typeof param1 === 'string' && param2 === undefined) {
            [param1, param2] = param1.split(',').map(s => s.trim());
        }
        // Handle array format: [lat, lng]
        else if (Array.isArray(param1)) {
            [param1, param2] = param1;
        }
        // Handle object format: { lat, lng } or { latitude, longitude }
        else if (typeof param1 === 'object' && param1 !== null) {
            const obj = param1;
            param1 = obj.latitude ?? obj.lat;
            param2 = obj.longitude ?? obj.lng ?? obj.lon ?? obj.long;
        }

        // Check if we have valid parameters (allow 0 as valid coordinate)
        if (param1 == null || param2 == null) {
            return null;
        }

        const latitude = Number(param1);
        const longitude = Number(param2);

        // Validate the converted numbers and ranges
        if (
            Number.isNaN(latitude) ||
            Number.isNaN(longitude) ||
            latitude < LATITUDE_MIN ||
            latitude > LATITUDE_MAX ||
            longitude < LONGITUDE_MIN ||
            longitude > LONGITUDE_MAX
        ) {
            return null;
        }

        return [latitude, longitude];
    },

    isValidCoords(...args) {
        return Boolean(this.getCoords(...args));
    }
};
