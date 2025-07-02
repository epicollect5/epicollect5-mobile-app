const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;


export const isValidCoordsService = {

    getCoords(param1, param2) {
        // 'lat, lng'
        if (typeof param1 === 'string' && typeof param2 === 'undefined') {
            [param1, param2] = param1.split(',');
        }
        // [lat, lng]
        else if (Array.isArray(param1)) {
            [param1, param2] = param1;
        }
        // { lat, lng }
        else if (typeof param1 === 'object' && param1 !== null) {
            param1 = param1.latitude ?? param1.lat;
            param2 = param1.longitude ?? param1.lng ?? param1.lon ?? param1.long;
            // Note: Above won't work because param1 is reassigned, so we need a temp object:
        }

        // Fix above logic for object case
        if (typeof param1 === 'object' && param1 !== null) {
            const parts = param1;
            param1 = parts.latitude ?? parts.lat;
            param2 = parts.longitude ?? parts.lng ?? parts.lon ?? parts.long;
        }

        if (
            (param1 === undefined || param1 === null) &&
            typeof param1 !== 'number'
        ) {
            return null;
        }
        if (
            (param2 === undefined || param2 === null) &&
            typeof param2 !== 'number'
        ) {
            return null;
        }

        const latitude = Number(param1);
        const longitude = Number(param2);

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

