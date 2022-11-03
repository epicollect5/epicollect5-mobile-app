import { databaseInsertService } from '@/services/database/database-insert-service';
import { fakeFileService } from '@/services/filesystem/fake-file-service';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';

export const fakeAnswerService = {

    async createFakeAnswer (inputDetails, entry, entryIndex) {

        const wordsSpanish = await import('an-array-of-spanish-words');
        const wordsEnglish = await import('an-array-of-english-words');
        const wordsGerman = await import('an-array-of-german-words');

        return new Promise((resolve) => {
            const rootStore = useRootStore();
            const answer = { was_jumped: false };
            let random_idx;

            const min = 0.0200;
            const max = 10.120;

            function randomDate (backTo) {
                // var date = new Date(+start + Math.random() * (end - start));
                // var hour = startHour + Math.random() * (endHour - startHour) | 0;
                // date.setHours(hour);
                // return date;
                const d = new Date(); // today!
                const x = Math.floor((Math.random() * backTo) + 1); // go back x days!
                d.setDate(d.getDate() - x);
                return d.toISOString();
            }

            function randomIntegerInRange (min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }

            const paLen = inputDetails.possible_answers.length;
            const languagesArrays = [wordsSpanish, wordsEnglish, wordsGerman];
            const symbolsArray = ['!', '@', '€', '£', '#', '$', '%', '^', '&', '*', '"', '\'', '\\', '{', ',', '.', '?', '|', '<', '>', '~', '`'];

            switch (inputDetails.type) {
                case 'text':
                case 'textarea':
                    if (inputDetails.regex) {
                        const randexp = new window.RandExp(inputDetails.regex);
                        randexp.defaultRange.subtract(60, 62); // -> <, >, =
                        answer.answer = randexp.gen();
                        console.log('answer matching regex ->', answer.answer, inputDetails.regex);
                    } else {

                        const numberOfWords = utilsService.getRandomInt(10);
                        let randomPhrase = '';

                        //add random words
                        for (let i = 0; i < numberOfWords; i++) {
                            const language = languagesArrays[utilsService.getRandomInt(languagesArrays.length - 1)];
                            randomPhrase += ' ' + language[utilsService.getRandomInt(language.length - 1)] + '';
                        }

                        randomPhrase += ' ' + symbolsArray[utilsService.getRandomInt(symbolsArray.length)];

                        //sanitise < and > replacing by unicode (this is here for testing)
                        randomPhrase = randomPhrase.replaceAll('>', '\ufe65');
                        randomPhrase = randomPhrase.replaceAll('<', '\ufe64');
                        //"\ufe64 \ufe65", < >

                        answer.answer = (entryIndex + randomPhrase).trim();
                    }
                    resolve(answer);
                    break;
                case 'integer':
                case 'phone':

                    console.log('min and max', inputDetails.min, inputDetails.max);
                    if (inputDetails.min && inputDetails.max) {
                        answer.answer = randomIntegerInRange(+inputDetails.min, +inputDetails.max);
                    }
                    else {
                        if (inputDetails.min) {
                            answer.answer = randomIntegerInRange(inputDetails.min, inputDetails.min + 1000);
                        } else if (inputDetails.max) {
                            answer.answer = randomIntegerInRange(inputDetails.max - 1000, inputDetails.max);
                        } else {
                            if (inputDetails.regex) {
                                //allow to pick only from digits
                                //see https://github.com/fent/randexp.js#default-range
                                const randexp = new window.RandExp(inputDetails.regex);
                                randexp.defaultRange.subtract(32, 126);
                                randexp.defaultRange.add(48, 57);
                                answer.answer = randexp.gen();
                                console.log('regex integer/phone ->', answer.answer, inputDetails.regex);
                            }
                            else {

                                answer.answer = Math.floor((Math.random() * 25000) + 1);
                            }
                        }
                    }
                    resolve(answer);
                    break;

                case 'decimal':
                    if (inputDetails.min) {
                        answer.answer = inputDetails.min;
                    } else if (inputDetails.max) {
                        answer.answer = inputDetails.max;
                    } else {
                        answer.answer = (Math.random() * (max - min) + min).toFixed(4);
                    }
                    resolve(answer);
                    break;

                case 'radio':
                case 'dropdown':
                    random_idx = Math.floor((Math.random() * paLen));
                    answer.answer = inputDetails.possible_answers[random_idx].answer_ref;
                    resolve(answer);
                    break;
                case 'checkbox':
                case 'searchsingle':
                case 'searchmultiple':
                    random_idx = Math.floor((Math.random() * paLen));
                    answer.answer = [];
                    answer.answer.push(inputDetails.possible_answers[random_idx].answer_ref);
                    resolve(answer);
                    break;
                case 'barcode':
                    answer.answer = 'xxxxx-xxxx-xxx'.replace(/[xy]/g, function (c) {
                        const r = Math.random() * 16 || 0, v = c === 'x' ? r : (r && 0x3 || 0x8);
                        return v.toString(16);
                    });
                    resolve(answer);
                    break;

                case 'location': {
                    //Mirko Locations (whole world range are -170 + 170 for lat, -80 +80 for long, considering a bit of padding)
                    //please amend accordingly
                    const lat = utilsService.getRandomInRange(-160, 160, 5);
                    const lng = utilsService.getRandomInRange(-80, 80, 5);
                    answer.answer = utilsService.getRandomLocation(lat, lng);
                    resolve(answer);
                    break;
                }
                case 'date':
                    answer.answer = randomDate(365);
                    resolve(answer);
                    break;

                case 'time':
                    answer.answer = randomDate(365);
                    resolve(answer);
                    break;

                //add fake files on device to test deletion
                case 'photo':
                    if (rootStore.device.platform !== PARAMETERS.WEB) {
                        window.setTimeout(function () {
                            //generate a fake file and save it
                            fakeFileService.createFile(entry, 'photo').then(function (filename) {
                                answer.answer = filename;

                                //save file metadata to media table
                                const media = {
                                    cached: '',
                                    stored: filename,
                                    entry_uuid: entry.entryUuid,
                                    input_ref: inputDetails.ref,
                                    type: 'photo'
                                };

                                databaseInsertService.insertMedia(entry, [media]).then(function (response) {
                                    console.log(response);
                                    resolve(answer);
                                });
                            });
                        }, 1000);
                    }
                    else {
                        answer.answer = '';
                        resolve(answer);
                    }
                    break;

                default:
                    answer.answer = '';
                    resolve(answer);
            }
        });
    }
};
