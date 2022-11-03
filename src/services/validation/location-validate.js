import { utilsService } from '@/services/utilities/utils-service';

export const locationValidate = {

    errors: {},
    check (params) {
        const inputDetails = params.input_details;
        const answer = params.answer.answer;


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
            if (!utilsService.isValidLatitude(answer.latitude)) {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }
        if (answer.longitude !== '') {
            if (!utilsService.isValidLongitude(answer.longitude)) {
                this.errors[inputDetails.ref] = ['ec5_30'];
                return false;
            }
        }
        if (answer.accuracy !== '') {
            if (!utilsService.isValidAccuracy(answer.accuracy)) {
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