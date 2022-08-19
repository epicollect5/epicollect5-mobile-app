export const locationValidate = {

    errors: {},
    check (params) {
        const inputDetails = params.input_details;
        const answer = params.answer.answer;

        debugger;

        function isLatitude (lat) {

            if (!lat.includes('.')) {
                return false;
            }

            if (lat.split('.')[1].length !== 6) {
                return false;
            }

            return isFinite(lat) && Math.abs(lat) <= 90;
        }

        function isLongitude (lng) {
            if (!lng.includes('.')) {
                return false;
            }

            if (lng.split('.')[1].length !== 6) {
                return false;
            }
            return isFinite(lng) && Math.abs(lng) <= 180;
        }

        //accuracy must be a positive integer
        function isAccuracy (accuracy) {
            const num = Number(accuracy);

            if (Number.isInteger(num) && num > 0) {
                return true;
            }

            return false;
        }
        //"ec5_30": "Location data not valid.",
        if (!Object.prototype.hasOwnProperty.call(answer, 'latitude')) {
            this.errors[inputDetails.ref] = ['ec5_30'];
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(answer, 'longitude')) {
            this.errors[inputDetails.ref] = ['ec5_30'];
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(answer, 'accuracy')) {
            this.errors[inputDetails.ref] = ['ec5_30'];
            return false;
        }

        if (answer.latitude !== '') {
            if (!isLatitude(answer.latitude)) {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }
        if (answer.longitude !== '') {
            if (!isLongitude(answer.longitude)) {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }
        if (answer.accuracy !== '') {
            if (!isAccuracy(answer.accuracy)) {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }

        //check all of lat, long, acc have a value

        //if latitude, we must have long, acc
        if (answer.latitude !== '') {
            if (answer.longitude === '' || answer.accuracy === '') {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }
        //if longitude, we must have lat, acc
        if (answer.longitude !== '') {
            if (answer.latitude === '' || answer.accuracy === '') {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }

        //if accuracy, we must have lat and long
        if (answer.accuracy !== '') {
            if (answer.latitude === '' || answer.longitude === '') {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }

        return true;
    }
};