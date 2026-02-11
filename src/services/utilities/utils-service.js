import {useRootStore} from '@/stores/root-store';
import {DEMO_PROJECT, PARAMETERS} from '@/config';
import {Capacitor} from '@capacitor/core';
import {Network} from '@capacitor/network';
import {projectModel} from '@/models/project-model.js';
import slugify from 'slugify';
import {isValidCoordsService} from '@/services/utilities/is-valid-coords-service';
import {initService} from '@/services/init-service';
import {STRINGS} from '@/config/strings';
import {databaseSelectService} from '@/services/database/database-select-service';
import {CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint} from '@capacitor/barcode-scanner';
import {v4 as uuidv4} from 'uuid';
import {notificationService} from '@/services/notification-service';
import {Filesystem, Directory} from '@capacitor/filesystem';

export const utilsService = {

    /**
     * Generate a UUID v4 (cryptographically strong if possible)
     * Works in browsers, React Native, Node.js
     * @returns {string} UUID v4
     */
    uuid() {
        return uuidv4();
    },

    //get timezone based on device settings
    getTimeZone() {
        const offset = new Date().getTimezoneOffset(), o = Math.abs(offset);
        return (offset < 0 ? '+' : '-') + ('00' + Math.floor(o / 60)).slice(-2) + ':' + ('00' + (o % 60)).slice(-2);
    },

    getInputFormattedDate(date) {
        const year = date.slice(0, 4);
        const month = date.slice(5, 7);
        const day = date.slice(8, 10);

        return year + '-' + month + '-' + day;
    },
    //https://stackoverflow.com/questions/49330139/date-toisostring-but-local-time-instead-of-utc
    toISOStringLocale(d) {
        const z = (n) => ('0' + n).slice(-2);
        const zz = (n) => ('00' + n).slice(-3);
        let off = d.getTimezoneOffset();
        const sign = off > 0 ? '-' : '+';
        off = Math.abs(off);

        const iso = d.getFullYear() + '-'
            + z(d.getMonth() + 1) + '-' +
            z(d.getDate()) + 'T' +
            z(d.getHours()) + ':' +
            z(d.getMinutes()) + ':' +
            z(d.getSeconds()) + '.' +
            zz(d.getMilliseconds());
        //  sign + z(off / 60 | 0) + ':' + z(off % 60);

        return iso;
    },

    getInputFormattedTime(input_date, format) {

        //"1970-01-01T01:03:00.000"
        const timepart = input_date.split('T')[1];
        const hours = timepart.slice(0, 2);
        const minutes = timepart.slice(3, 5);
        const seconds = timepart.slice(6, 8);

        let formattedTime;

        //remove seconds if not needed
        switch (format) {
            case PARAMETERS.TIME_FORMAT_3:
                //HH:mm (24hrs format)
                formattedTime = hours + ':' + minutes;
                break;
            case PARAMETERS.TIME_FORMAT_4:
                //hh:mm (12 hrs format)
                formattedTime = hours + ':' + minutes;
                break;
            default:
                formattedTime = hours + ':' + minutes + ':' + seconds;
        }

        return formattedTime;
    },

    //picker is shown on device when time format has seconds
    getPickerFormattedTime(input_date, format) {

        //"1970-01-01T01:03:00.000"
        const timepart = input_date.split('T')[1];
        const hours = timepart.slice(0, 2);
        const minutes = timepart.slice(3, 5);
        const seconds = timepart.slice(6, 8);

        let formattedTime;

        switch (format) {
            case PARAMETERS.TIME_FORMAT_5:
                //mm:ss
                formattedTime = minutes + ':' + seconds;
                break;
            default:
                //HH::mm::ss (24 hr) OR hh:mm:ss (12 hr)
                formattedTime = hours + ':' + minutes + ':' + seconds;
        }

        return formattedTime;
    },

    getUserFormattedTime(dateISO, format) {

        const timepart = dateISO.split('T')[1];
        const hours24 = timepart.slice(0, 2);
        const minutes = timepart.slice(3, 5);
        const seconds = timepart.slice(6, 8);
        let hours12;
        let formatted_time;
        const ampm = hours24 >= 12 ? 'PM' : 'AM';

        //convert 24 format to 12 format
        if (parseInt(hours24, 10) > 12) {
            hours12 = ((parseInt(hours24, 10) + 11) % 12) + 1;
            //prepend zero when needed
            hours12 = hours12 < 10 ? '0' + hours12.toString() : hours12;
        } else {
            hours12 = hours24;
        }

        switch (format) {
            case PARAMETERS.TIME_FORMAT_1:
                //HH:mm:ss (24 hrs format)
                formatted_time = hours24 + ':' + minutes + ':' + seconds;
                break;
            case PARAMETERS.TIME_FORMAT_2:
                //hh:mm:ss (12 hrs format)
                formatted_time = hours12 + ':' + minutes + ':' + seconds + ' ' + ampm;
                break;
            case PARAMETERS.TIME_FORMAT_3:
                //HH:mm (24hrs format)
                formatted_time = hours24 + ':' + minutes;
                break;
            case PARAMETERS.TIME_FORMAT_4:
                //hh:mm (12 hrs format)
                formatted_time = hours12 + ':' + minutes + ' ' + ampm;
                break;
            case PARAMETERS.TIME_FORMAT_5:
                //mm:ss
                formatted_time = minutes + ':' + seconds;
                break;
        }
        return formatted_time;
    },

    getUserFormattedDate(dateISO, format) {

        const year = dateISO.slice(0, 4);
        const month = dateISO.slice(5, 7);
        const day = dateISO.slice(8, 10);

        let formattedDate = '';

        switch (format) {
            case PARAMETERS.DATE_FORMAT_1:
                //'dd/MM/YYYY',
                formattedDate = day + '/' + month + '/' + year;
                break;
            case PARAMETERS.DATE_FORMAT_2:
                //'MM/dd/YYYY',
                formattedDate = month + '/' + day + '/' + year;
                break;
            case PARAMETERS.DATE_FORMAT_3:
                formattedDate = year + '/' + month + '/' + day;
                //'YYYY/MM/dd',
                break;
            case PARAMETERS.DATE_FORMAT_4:
                //'MM/YYYY',
                formattedDate = month + '/' + year;
                break;
            case PARAMETERS.DATE_FORMAT_5:
                //'dd/MM',
                formattedDate = day + '/' + month;
                break;
        }

        return formattedDate;
    },

    /*
     Value for media is created like {input ref}_{YYYYMMDD}_{filename} where file name will be {timestamp}.{ext}
     */
    generateMediaFilename(uuid, type) {

        let ext;

        switch (type) {
            case PARAMETERS.QUESTION_TYPES.PHOTO:
                ext = PARAMETERS.PHOTO_EXT;
                break;
            case PARAMETERS.QUESTION_TYPES.AUDIO:
                ext = PARAMETERS.AUDIO_EXT;
                break;
            case PARAMETERS.QUESTION_TYPES.VIDEO:
                ext = PARAMETERS.VIDEO_EXT;
                break;
        }

        return uuid + '_' + this.generateTimestamp() + ext;
    },

    generateTimestamp() {
        return Math.floor(Date.now() / 1000);
    },

    //Get ISO8601 representation in UTC, removing timezone
    getISODateTime(date) {

        const self = this;

        //// If we weren't supplied a date, generate a new one
        if (!date) {
            date = new Date();
        }

        //IMPORTANT: store dates removing timezone, UTC for the wins!
        //this is for ordering, then the user will see the date converted to the local timezone anyway
        //add 'Z' to indicate Zulu time (UTC, timezone offest 0)

        return self.getISOTime(self.convertDateToUTC(date)) + 'Z';
    },

    //get ISO date with time set to 00:00:00.000
    getISODateOnly(dateISO) {
        return this.getISODateOnlySafeEmpty(dateISO);
    },

    // normalize and return canonical "YYYY-MM-DDT00:00:00.000" or "" on invalid
    normalizeToISODateOnlyEmpty(input) {
        // treat null/undefined/empty-string as invalid -> return empty string
        if (input === null || input === undefined || input === '') return '';

        // ensure string
        if (typeof input !== 'string') input = String(input);

        // match YYYY-M-D optionally followed by T...
        const m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
        if (!m) return '';

        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);

        if (month < 1 || month > 12) return '';

        // max days for the given month/year using UTC to avoid timezone issues
        const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (day < 1 || day > maxDays) return '';

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');

        return `${year}-${mm}-${dd}T00:00:00.000`;
    },

    // robust replacement for getISODateOnly that returns "" for invalid inputs
    getISODateOnlySafeEmpty(input) {
        // explicit handling: null or empty string -> return empty string (per your requirement)
        if (input === null || input === '' || input === undefined) return '';

        if (typeof input === 'string') {
            // try to normalize string formats like "2024-5-4" -> "2024-05-04T00:00:00.000"
            return this.normalizeToISODateOnlyEmpty(input); // "" on invalid, canonical string on success
        }

        // Non-string path (Date object or timestamp)
        const d = new Date(input || Date.now());
        if (isNaN(d.getTime())) return ''; // invalid date -> empty string

        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');

        return `${y}-${m}-${day}T00:00:00.000`;
    },

    getTimezoneOffset(date) {

        const timezone_offset_min = date.getTimezoneOffset();
        let offset_hrs = parseInt(Math.abs(timezone_offset_min / 60));
        let offset_min = Math.abs(timezone_offset_min % 60);
        let timezone_standard;

        if (offset_hrs < 10) {
            offset_hrs = '0' + offset_hrs;
        }

        if (offset_min < 10) {
            offset_min = '0' + offset_min;
        }

        // Add an opposite sign to the offset
        // If offset is 0, it means timezone is UTC
        if (timezone_offset_min < 0) {
            timezone_standard = '+' + offset_hrs + ':' + offset_min;
        } else if (timezone_offset_min > 0) {
            timezone_standard = '-' + offset_hrs + ':' + offset_min;
        } else if (timezone_offset_min === 0) {
            timezone_standard = 'Z';
        }

        // Timezone difference in hours and minutes
        // String such as +5:30 or -6:00 or Z
        console.log(timezone_standard);

        return timezone_standard;
    },

    //get time in ISO format with milliseconds set to .000
    getISOTime(dt) {

        let date = dt.getDate();
        let month = dt.getMonth() + 1;
        const year = dt.getFullYear();
        let hrs = dt.getHours();
        let mins = dt.getMinutes();
        let secs = dt.getSeconds();

        // Add 0 before date, month, hrs, mins or secs if they are less than 0
        date = date < 10 ? '0' + date : date;
        month = month < 10 ? '0' + month : month;
        hrs = hrs < 10 ? '0' + hrs : hrs;
        mins = mins < 10 ? '0' + mins : mins;
        secs = secs < 10 ? '0' + secs : secs;

        // Current datetime
        return year + '-' + month + '-' + date + 'T' + hrs + ':' + mins + ':' + secs + '.000';
    },

    //convert a local date to UTC date, so real date without the timezone offset added in
    convertDateToUTC(date, removeMilliseconds) {

        if (removeMilliseconds) {
            return new Date(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds()
            );
        } else {
            return new Date(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds()
            );
        }
    },

    //add/remove the timezone offset from the local time to level out timezone differences and have the Date in GMT always
    getDateWithCompensatedTimezone(date) {

        //local date
        const compDate = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        //remove timezone
        compDate.setTime(compDate.getTime() + compDate.getTimezoneOffset() * 60 * 1000);
        return compDate;
    },

    /**
     * Map media object to array filtering out all the inputs without any answer.
     * The media object is first indexed by entryUuid, then inputRef. ie media[entryUuid][inputRef] = {}
     *
     * @param entryMediaObj
     * @returns {Array}
     */
    mapMediaObjectToArray(entryMediaObj) {
        console.log(entryMediaObj);
        const array = [];

        Object.keys(entryMediaObj).map(function (entryUuid) {

            const inputMediaObj = entryMediaObj[entryUuid];

            /**
             *  Filter empty answers
             *  A file is only saved when 'cached' has a value
             */
            Object.keys(inputMediaObj).map(function (inputRef) {
                // todo check why cached undefined
                if (inputMediaObj[inputRef].cached !== '') {
                    array.push({
                        entry_uuid: entryUuid,
                        input_ref: inputRef,
                        cached: inputMediaObj[inputRef].cached,
                        stored: inputMediaObj[inputRef].stored,
                        type: inputMediaObj[inputRef].type
                    });
                }
            });

        });

        return array;
    },

    /**
     * Serialize an object to a url string
     *
     * @param obj
     * @returns {string}
     */
    serializeToUrl(obj) {
        const str = [];
        for (const p in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, p)) {
                str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
            }
        }
        return str.join('&');
    },

    /**
     *
     * @param str
     * @returns {*}
     */
    stripTrailingSlash(str) {
        if (str.substr(-1) === '/') {
            return str.substr(0, str.length - 1).toLowerCase();
        }
        return str.toLowerCase();
    },

    /**
     *
     * @param obj
     * @returns {string}
     */
    serializeObj(obj) {
        const result = [];

        Object.keys(obj).forEach(function (key, index) {
            result.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        });

        return result.join('&');
    },

    htmlDecode(input) {

        let html = '';
        let div;
        let scripts = '';
        let i;

        div = document.createElement('div');
        div.innerHTML = input;
        // Get parsed html
        html = div.childNodes.length === 0 ? '' : div.childNodes[0].nodeValue;

        // Now remove all script tags
        div = document.createElement('div');
        div.innerHTML = html;
        scripts = div.getElementsByTagName('script');
        // Loop them and remove
        i = scripts.length;
        while (i--) {
            scripts[i].parentNode.removeChild(scripts[i]);
        }

        // Return the inner html
        return div.innerHTML;
    },

    /**
     * Convert a base64 string in a Blob according to the data and contentType.
     * Strip the prefix if present
     *
     * @param b64Data {String} Pure base64 string without contentType
     * @param contentType {String} the content type of the file i.e (image/jpeg - image/png - text/plain)
     * @param sliceSize {Int} SliceSize to process the byteCharacters
     * @see http://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
     * @return Blob
     */
    b64toBlob(b64Data, contentType, sliceSize) {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;

        // Strip the prefix if present
        const base64 = String(b64Data).includes(',') ? b64Data.split(',')[1] : b64Data;

        const byteCharacters = atob(base64);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, {type: contentType});
    },
    async hasInternetConnection() {
        return new Promise((resolve) => {
            (async function () {
                const rootStore = useRootStore();
                if (rootStore.device.platform === PARAMETERS.WEB) {
                    resolve(window.navigator.onLine);
                } else {
                    const networkState = await Network.getStatus();
                    console.log('Network connection type: ', networkState.connectionType);
                    resolve(networkState.connected);
                }
            }());
        });
    },

    //Open a barcode and return a result
    async triggerBarcode() {
        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {
            //trigger call to barcode with a bit of delay to allow the spinner to appear
            window.setTimeout(async function () {

                if (rootStore.device.platform === PARAMETERS.WEB) {
                    resolve('');
                }

                CapacitorBarcodeScanner.scanBarcode({
                    hint: CapacitorBarcodeScannerTypeHint.ALL
                }).then(
                    (result) => {
                        resolve({text: result.ScanResult});
                    },
                    (error) => {
                        //do not show error if the user cancelled the scan
                        if (error.code === 'OS-PLUG-BARC-0006') {
                            //we resolve() with a user cancelled flag
                            resolve({cancelled: true});
                        }
                        reject(error);
                    }
                );
            }, 250);
        });
    },

    /*
     * Get app version name
     */
    //todo: not sure we still need this
    async getAppVersion() {
        const rootStore = useRootStore();
        return new Promise((resolve) => {

            if (rootStore.device.platform === PARAMETERS.WEB) {
                resolve('');
            }
            /**
             * Android - android/app/build.gradle (you're looking for the versionName variable)
             * iOS - ios/App/App/Info.plist *(you're looking for the CFBundleShortVersionString key)
             */
            resolve(rootStore.app.version);
        });
    },

    async getAppName() {
        const rootStore = useRootStore();
        return new Promise((resolve) => {
            if (rootStore.device.platform === PARAMETERS.WEB) {
                resolve('Epicollect5');
            }
            resolve(rootStore.app.name);
        });
    },

    getFileType(filename) {

        const parts = filename.split('.');
        const ext = parts[parts.length - 1];
        let type;

        switch ('.' + ext) {
            case PARAMETERS.PHOTO_EXT:
                type = PARAMETERS.QUESTION_TYPES.PHOTO;
                break;
            case PARAMETERS.AUDIO_EXT:
                type = PARAMETERS.QUESTION_TYPES.AUDIO;
                break;
            case PARAMETERS.VIDEO_EXT:
                type = PARAMETERS.QUESTION_TYPES.VIDEO;
                break;
        }
        return type;
    },

    getFilePath(file_type) {

        let path = '';

        switch (file_type) {
            case PARAMETERS.QUESTION_TYPES.PHOTO:
                path = PARAMETERS.PHOTO_DIR;
                break;
            case PARAMETERS.QUESTION_TYPES.AUDIO:
                path = PARAMETERS.AUDIO_DIR;
                break;
            case PARAMETERS.QUESTION_TYPES.VIDEO:
                path = PARAMETERS.VIDEO_DIR;
                break;
        }
        return path;
    },

    getMIMEType(file_type) {

        const rootStore = useRootStore();
        let mime_type;

        switch (file_type) {
            case PARAMETERS.EC5_AUDIO_TYPE:
                mime_type = 'audio/mp4';
                break;
            case PARAMETERS.EC5_VIDEO_TYPE:
                mime_type = 'video/mp4';
                break;
            default:
                mime_type = 'image/jpeg';
        }
        return mime_type;
    },

    getProjectNameMarkup(hideName) {

        let appStoragePath = '';
        let markup = '';
        const rootStore = useRootStore();

        //PWA + WEB debug
        if (!Capacitor.isNativePlatform()) {
            //PWA (or WEB debug) gets project logo from server
            console.log(rootStore.serverUrl);
            const projectSlug = projectModel.getSlug();
            const apiEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT + PARAMETERS.API.ROUTES.PWA.MEDIA;
            const logoURL = rootStore.serverUrl + apiEndpoint + projectSlug + PARAMETERS.API.PARAMS.PROJECT_LOGO_QUERY_STRING;

            markup = '<img class="project-logo" width="32" height="32" src="' + logoURL + '"/>';
            markup += hideName ? '' : '<span>&nbsp;' + projectModel.getProjectName().toUpperCase() + '</span>';
        }

        //Android & iOS
        if (Capacitor.isNativePlatform()) {
            if (projectModel.getProjectRef() === DEMO_PROJECT.PROJECT_REF) {
                appStoragePath = rootStore.persistentDir + PARAMETERS.LOGOS_DIR + projectModel.getProjectRef() + '/mobile-logo.jpg?' + new Date().getTime();
                markup = '<img class="project-logo" width="32" height="32" src="' + appStoragePath + '" onError="this.src = \'assets/images/ec5-demo-project-logo.jpg\'"/>';
                markup += hideName ? '' : '<span>&nbsp;' + projectModel.getProjectName().toUpperCase() + '</span>';
            } else {
                appStoragePath = rootStore.persistentDir + PARAMETERS.LOGOS_DIR + projectModel.getProjectRef() + '/mobile-logo.jpg?' + new Date().getTime();
                //fix for WKWebView
                appStoragePath = Capacitor.convertFileSrc(appStoragePath);
                markup = '<img class="project-logo" width="32" height="32" src="' + appStoragePath + '" onError="this.src = \'assets/images/ec5-placeholder-100x100.jpg\'"/>';
                markup += hideName ? '' : '<span >&nbsp;' + projectModel.getProjectName().toUpperCase() + '</span>';
            }
        }

        return markup;
    },
    trunc(str, desiredLength, useEllipsis) {
        if (str.length <= desiredLength) {
            return str;
        } else if (desiredLength >= 3) {
            if (useEllipsis) {
                const truncated = str.substr(0, desiredLength - 3); // Subtract 3 for the ellipsis
                return truncated + '...';
            } else {
                const truncated = str.substr(0, desiredLength);
                return truncated;
            }
        } else {
            return str.substr(0, desiredLength);
        }
    },
    generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomString = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            randomString += characters.charAt(randomIndex);
        }

        return randomString;
    },
    hasQuestionError(state) {
        if (Object.keys(state.error.errors).length > 0) {
            if (!state.error?.errors[state.currentInputRef]?.message) {
                return false;
            }
            return true;
        }
        return false;
    },
    objectsMatch(obj, source) {
        return Object.keys(source).every(
            (key) => Object.prototype.hasOwnProperty.call(obj, key) && obj[key] === source[key]
        );
    },
    //get a hash map like hashMap[answer_ref] = answer for quicker lookups
    buildPossibleAnswersHashMap(possibleAnswers) {
        const hashMap = {};

        possibleAnswers.forEach((possibleAnswer) => {
            hashMap[possibleAnswer.answer_ref] = possibleAnswer.answer;
        });

        return hashMap;
    },
    getStepPrecision(precision) {
        let inputStep = '0.';
        for (let i = 0; i < precision - 1; i++) {
            inputStep += '0';
        }
        inputStep += '1';

        return parseFloat(inputStep);
    },
    questionHasError(questionState) {

        if (questionState.error?.errors?.[questionState.currentInputRef]?.message?.trim() === '') {
            //no error message , answer is valid
            return false;
        }
        if (questionState.error?.errors?.[questionState.currentInputRef]?.message === undefined) {
            //no message key , answer is valid
            return false;
        }
        return true;
    },
    filterObjectsByUniqueKey(arrayOfObjects, keyname) {
        const output = [], keys = [];

        arrayOfObjects.forEach((item) => {
            const key = item[keyname];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });
        return output;
    },
    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    },
    getSanitisedAnswer(value) {
        let answer = value.trim();
        //sanitise < and > replacing by Unicode
        answer = answer.replaceAll('>', '\ufe65');
        answer = answer.replaceAll('<', '\ufe64');
        return answer;
    },
    getPlatformDocumentsFolder() {
        const rootStore = useRootStore();

        switch (rootStore.device.platform) {
            case PARAMETERS.ANDROID:
                // Use Documents for Scoped Storage compatibility
                return Directory.Documents;
            case PARAMETERS.IOS:
                return Directory.Documents;
            default:
                return null;
        }
    },
    generateFilenameForExport(prefix, body) {
        /**
         *  Truncate anything bigger than 100 chars
         *  to keep the filename unique, a prefix (with index) is passed
         *
         *  We do this as we might have filename too long (i.e. branch question of 255),
         *  then adding prefix we go over the max filename length (255)
         *
         * then slugify() will take of foreign chars, spaces, symbols, ect..
         */

        return prefix + '__' + slugify(this.trunc(body.toLowerCase(), 100));
    },
    getHoursColumnPicker() {
        const hours = Array.from({length: 24}, (_, index) => index);
        return hours.map((value) => {
            return {
                description: value > 9 ? value.toString() : '0' + value.toString()
            };
        });
    },
    getMinutesColumnPicker() {
        const minutes = Array.from({length: 60}, (_, index) => index);
        return minutes.map((value) => {
            return {
                description: value > 9 ? value.toString() : '0' + value.toString()
            };
        });
    },
    getSecondsColumnPicker() {
        return this.getMinutesColumnPicker();
    },
    //generate PHP type uniqid to be appended to form, inputs, branch and groups
    generateUniqID(prefix, more_entropy) {
        if (typeof prefix === 'undefined') {
            prefix = '';
        }

        let retId;
        const formatSeed = function (seed, reqWidth) {
            seed = parseInt(seed, 10)
                .toString(16); // to hex str
            if (reqWidth < seed.length) {
                // so long we split
                return seed.slice(seed.length - reqWidth);
            }
            if (reqWidth > seed.length) {
                // so short we pad
                return Array(1 + (reqWidth - seed.length))
                    .join('0') + seed;
            }
            return seed;
        };

        // BEGIN REDUNDANT
        if (!this.php_js) {
            this.php_js = {};
        }
        // END REDUNDANT
        if (!this.php_js.uniqidSeed) {
            // init seed with big random int
            this.php_js.uniqidSeed = Math.floor(Math.random() * 0x75bcd15);
        }
        this.php_js.uniqidSeed++;

        // start with prefix, add current milliseconds hex string
        retId = prefix;
        retId += formatSeed(parseInt(new Date()
            .getTime() / 1000, 10), 8);
        // add seed hex string
        retId += formatSeed(this.php_js.uniqidSeed, 5);
        if (more_entropy) {
            // for more entropy we add a float lower to 10
            retId += (Math.random() * 10)
                .toFixed(8)
                .toString();
        }

        return retId;
    },
    getRandomInRange(from, to, fixed) {
        return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
        // .toFixed() returns string, so ' * 1' is a trick to convert to number
    },
    getRandomLocation(lat, long) {

        function normish(mean, range) {
            const num_out = ((Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2) * range + mean;
            return num_out;
        }

        const x = normish(0, 0.01);
        const y = normish(0, 0.01);
        return {
            longitude: (((x * 0.1) + long)).toFixed(6),
            latitude: (((y * 0.1) + lat)).toFixed(6),
            accuracy: this.getRandomInRange(3, 100, 0)
        };
    },
    getDataViewerURL(projectSlug) {
        const rootStore = useRootStore();

        return rootStore.serverUrl
            + PARAMETERS.API.ROUTES.PROJECT
            + projectSlug
            + PARAMETERS.API.ROUTES.PWA.DATA_VIEWER
            + PARAMETERS.API.PARAMS.DATA_VIEWER_RESTORE_QUERY_STRING;
    },
    isValidLatitude(lat) {
        if (!lat) {
            return false;
        }
        ///validate the latitude using third-party library
        return isValidCoordsService.isValidCoords(lat, 0);
    },
    isValidLongitude(long) {
        if (!long) {
            return false;
        }
        ///validate the longitude using third-party library
        return isValidCoordsService.isValidCoords(0, long);
    },
    //accuracy must be a positive integer
    isValidAccuracy(accuracy) {
        const num = Number(accuracy);
        return Number.isInteger(num) && num > 0;
    },
    //get base path from url, to be used by vue router and internal api requests
    getBasepath() {
        const url = new URL(window.location.href);
        const pathname = url.pathname;
        const pathnameParts = pathname.split('/');
        //remove last 3 segments /project/:slug/(add-entry|edit-entry)
        pathnameParts.pop();
        pathnameParts.pop();
        pathnameParts.pop();

        return pathnameParts.join('/');
    },
    isValidDecimalDegreesString(str) {
        const coords = this.extractCoordinates(str);
        if (coords === null) {
            return false;
        }
        return utilsService.isValidLatitude(coords.latitude) && utilsService.isValidLongitude(coords.longitude);
    },

    extractCoordinates(input) {
        const regex = /^([-+]?\d*[.,]?\d+),\s*([-+]?\d*[.,]?\d+)$/;
        const match = input.match(regex);

        // Check if there are more than three commas or exactly two commas
        //would be impossible to detect which one is lat, which one is long
        // if (input.split(',').length > 3 || input.split(',').length === 2) {
        //     // Handle the case where it's ambiguous
        //     return null;
        // }

        if (match) {
            const lat = (parseFloat(match[1].replace(',', '.')) || 0).toFixed(6);
            const long = (parseFloat(match[2].replace(',', '.')) || 0).toFixed(6);
            return {latitude: lat, longitude: long};
        } else {
            // Handle invalid input or return default values
            return null;
        }
    },
    isObject(obj) {
        return Object.prototype.toString.call(obj) === '[object Object]';
    },
    arrayGroupBy(arr, cb) {
        return arr.reduce((a, b, i) => ((a[cb(b, i, arr)] || (a[cb(b, i, arr)] = [])).push(b), a), {});
    },
    hasSameKeys(a, b) {
        // 1. Guard clause for null/non-object types
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
            console.error('Invalid input: both arguments must be non-null objects.');
            return false;
        }

        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);

        // 2. Optimization: Use Sets for O(1) lookups
        const setA = new Set(aKeys);
        const setB = new Set(bKeys);

        // Find what's in A, but not in B
        const missingInB = aKeys.filter((key) => !setB.has(key));
        // Find what's in B, but not in A
        const missingInA = bKeys.filter((key) => !setA.has(key));

        // 3. Logging with more context
        if (missingInB.length > 0) {
            console.error(`Object 'b' is missing keys: [${missingInB.join(', ')}]`);
            missingInB.forEach((key) => {
               console.error('Missing label for ', a[key]);
            });
        }

        if (missingInA.length > 0) {
            console.error(`Object 'a' is missing keys: [${missingInA.join(', ')}]`);
            missingInA.forEach((key) => {
                console.error('Missing label for ', b[key]);
            });
        }

        // 4. Final check
        return missingInA.length === 0 && missingInB.length === 0;
    },
    //validate language files to check for missing keys
    async validateLanguageFiles() {

        const defaultLanguage = await initService.getLanguageFile(PARAMETERS.DEFAULT_LANGUAGE);
        let validFiles = true;

        for (const supportedLanguage of PARAMETERS.SUPPORTED_LANGUAGES) {
            const statusCodes = await initService.getLanguageFile(supportedLanguage);
            if (!utilsService.hasSameKeys(defaultLanguage, statusCodes)) {
                console.error('Missing keys in language files (status codes)', supportedLanguage);
                validFiles = false;
            }
            if (!utilsService.hasSameKeys(STRINGS[PARAMETERS.DEFAULT_LANGUAGE].labels, STRINGS[supportedLanguage].labels)) {
                console.error('Missing keys in language files (labels)', supportedLanguage);
                validFiles = false;
            }
        }

        if (!validFiles) {
            if (PARAMETERS.DEBUG) {
                await notificationService.showAlert('Language files invalid');
            }
            throw new Error('Language files invalid');
        } else {
            console.log('%cLanguage files validated correctly', 'color: green; font-weight: bold;');
        }
    },

    async isJWTExpired() {
        return new Promise(function (resolve) {
            databaseSelectService.getUser().then(function (res) {
                let jwt;
                // Check if we have one
                if (res.rows.length > 0) {
                    jwt = res.rows.item(0).jwt;
                    const jwtDecoded = JSON.parse(window.atob(jwt.split('.')[1]));
                    resolve(jwtDecoded.exp < Date.now() / 1000);
                } else {
                    //not found, send expired  so we get a new one
                    resolve(true);
                }
            });
        });
    },

    inverseSlug(slug) {
        // Replace hyphens with spaces using a regular expression
        return slug.replace(/-/g, ' ');
    },
    //add 'file://' protocol if it is missing in the URI
    getProtocol(uri) {
        return uri.includes('file://') ? '' : 'file://';
    },

    generateCloneEntryBranch(sourceEntry) {
        return this.generateCloneEntry(sourceEntry);
    },
    generateCloneEntry(sourceEntry) {
        console.log(JSON.stringify(sourceEntry));

        const clonedEntry = JSON.parse(JSON.stringify(sourceEntry));
        clonedEntry.entryUuid = utilsService.uuid();
        clonedEntry.createdAt = utilsService.getISODateTime();
        clonedEntry.updatedAt = utilsService.getISODateTime();
        clonedEntry.synced = PARAMETERS.SYNCED_CODES.UNSYNCED;
        clonedEntry.canEdit = PARAMETERS.EDIT_CODES.CAN;
        clonedEntry.isRemote = PARAMETERS.REMOTE_CODES.ISNT;
        clonedEntry.syncedError = '';
        clonedEntry.media = {};
        clonedEntry.branchEntries = {};
        clonedEntry.uniqueAnswers = {};


        console.log(JSON.stringify(projectModel.getExtraForm(clonedEntry.formRef)));
        console.log(JSON.stringify(projectModel.getExtraInputs()));
        console.log(JSON.stringify(projectModel.getFormBranches(clonedEntry.formRef)));

        //get a clone of the existing answers (NOT reactive, otherwise it will change behind the scenes)
        const newAnswers = clonedEntry.answers;

        //we do not clone media files so find the media questions input_ref from project extra
        const mediaQuestionsInputRefs = projectModel.getMediaQuestions();

        //loop newAnswers and set media files to empty string
        mediaQuestionsInputRefs.forEach((mediaQuestionInputRef) => {
            if (newAnswers[mediaQuestionInputRef]) {
                newAnswers[mediaQuestionInputRef].answer = '';
            }
        });

        if (!sourceEntry.isBranch) {
            //we do not clone branches so set branch question to empty
            const branchQuestionsInputRefs = projectModel.getFormBranches(clonedEntry.formRef);
            Object.keys(branchQuestionsInputRefs).forEach((branchQuestionInputRef) => {
                newAnswers[branchQuestionInputRef] = {
                    was_jumped: false,
                    answer: ''
                };
            });
        }

        return clonedEntry;
    }
};
