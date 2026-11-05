import { databaseInsertService } from '@/services/database/database-insert-service';
import { fakeFilePhotoService } from '@/services/filesystem/fake-file-photo-service';
import { fakeFileAudioService } from '@/services/filesystem/fake-file-audio-service';
import { fakeFileVideoService } from '@/services/filesystem/fake-file-video-service';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';
import wordsSpanish from 'an-array-of-spanish-words';
import wordsEnglish from 'an-array-of-english-words';
import wordsGerman from 'an-array-of-german-words';
import RandExp from 'randexp';
import { regexService } from '@/services/validation/regex-service';

function escapeRegExp (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translatePcrePatternForRandExp (pattern) {
    if (typeof pattern !== 'string') {
        return null;
    }
    if (/\(\?(\(|[0-9]|&|P[=>]|C)/.test(pattern) || /\(\?(R|DEFINE)/.test(pattern) || /\(\?\([0-9<]/.test(pattern) || /\(\?\|/.test(pattern) || /\(\*[A-Z]/.test(pattern) || /\\g[{<]/.test(pattern)) {
        return null;
    }
    let flags = '';
    let jsPattern = pattern;
    jsPattern = jsPattern.replace(/\(\?([imsx]+):/g, (match, groupFlags) => {
        flags += groupFlags;
        return '(?:';
    });
    jsPattern = jsPattern.replace(/\(\?([imsx-]+)\)/g, (match, groupFlags) => {
        flags += groupFlags.replace(/-/g, '');
        return '';
    });
    jsPattern = jsPattern.replace(/\(\?P<[^>]+>/g, '(?:');
    jsPattern = jsPattern.replace(/\(\?<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?:');
    jsPattern = jsPattern.replace(/\(\?>/g, '(?:');
    jsPattern = jsPattern.replace(/\{(\d+(?:,\d*)?)\}\+/g, '{$1}');
    jsPattern = jsPattern.replace(/([*+?])\+/g, '$1');
    jsPattern = jsPattern.replace(/\\A/g, '^');
    jsPattern = jsPattern.replace(/\\G/g, '^');
    jsPattern = jsPattern.replace(/\\z/g, '$');
    jsPattern = jsPattern.replace(/\\Z/g, '$');
    jsPattern = jsPattern.replace(/\\K/g, '');
    jsPattern = jsPattern.replace(/\\Q([\s\S]*?)\\E/g, (match, quoted) => escapeRegExp(quoted));
    jsPattern = jsPattern.replace(/\\Q([\s\S]*)$/, (match, quoted) => escapeRegExp(quoted));
    jsPattern = jsPattern.replace(/\\h/g, '[ \\t]');
    jsPattern = jsPattern.replace(/\\H/g, '[^ \\t]');
    jsPattern = jsPattern.replace(/\\R/g, '\\n');
    jsPattern = jsPattern.replace(/\\p\{L\}/g, '[A-Za-z]');
    jsPattern = jsPattern.replace(/\\p\{N\}/g, '[0-9]');
    jsPattern = jsPattern.replace(/\[\[:alpha:\]\]/g, '[A-Za-z]');
    jsPattern = jsPattern.replace(/\[\[:digit:\]\]/g, '[0-9]');
    jsPattern = jsPattern.replace(/\[\[:alnum:\]\]/g, '[A-Za-z0-9]');
    jsPattern = jsPattern.replace(/\[\[:space:\]\]/g, '[\\s]');
    if (/\\p\{/.test(jsPattern) || /\\x\{/.test(jsPattern) || /\(\?/.test(jsPattern)) {
        return null;
    }
    const randexpFlags = (flags.indexOf('i') !== -1 ? 'i' : '') + (flags.indexOf('m') !== -1 ? 'm' : '');
    return { jsPattern, flags: randexpFlags };
}

async function generateFromRegex (originalPattern, digitOnly) {
    const translated = translatePcrePatternForRandExp(originalPattern);
    if (!translated) {
        return null;
    }
    let randexp;
    try {
        randexp = new RandExp(translated.jsPattern, translated.flags);
    } catch (error) {
        return null;
    }
    if (digitOnly) {
        randexp.defaultRange.subtract(32, 126);
        randexp.defaultRange.add(48, 57);
    } else {
        //remove invalid chars (for epicollect5 validation)
        randexp.defaultRange.subtract(60, 62); // -> <, >, =
    }
    for (let attempt = 0; attempt < 10; attempt++) {
        let candidate;
        try {
            candidate = randexp.gen();
        } catch (error) {
            return null;
        }
        try {
            if (await regexService.test(originalPattern, candidate)) {
                return candidate;
            }
        } catch (error) {
            //unverifiable (bad pattern, limit hit, engine unavailable):
            //no verified candidate, leave the question empty
            return null;
        }
    }
    return null;
}

export const fakeAnswerService = {

    failedRegexPatterns: [],

    hasUnescapedSlash (pattern) {
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '\\') {
                i++;
            } else if (pattern[i] === '/') {
                return true;
            }
        }
        return false;
    },

    recordFailedRegex (inputDetails) {
        if (!fakeAnswerService.failedRegexPatterns.some((failed) => failed.ref === inputDetails.ref)) {
            fakeAnswerService.failedRegexPatterns.push({
                ref: inputDetails.ref,
                question: inputDetails.question,
                regex: inputDetails.regex,
                required: inputDetails.is_required,
                //the server wraps patterns in /.../ delimiters, so an
                //unescaped slash breaks evaluation for every client
                serverIncompatible: fakeAnswerService.hasUnescapedSlash(inputDetails.regex)
            });
        }
    },

    async generateFromRegex (originalPattern, digitOnly) {
        return generateFromRegex(originalPattern, digitOnly);
    },

    async generateTextAnswer(inputDetails, answer, languagesArrays, symbolsArray, entryIndex) {
        if (inputDetails.regex) {
            const generated = await generateFromRegex(inputDetails.regex, false);
            if (generated !== null) {
                answer.answer = generated;
                console.log('answer matching regex ->', answer.answer, inputDetails.regex);
                return true;
            }
            //no verified candidate: leave the question empty so it saves
            //locally and skips the server regex check. Only a required
            //question can still fail, on upload (ec5_102/103/115)
            console.warn('regex not supported for fake generation, leaving empty -> ' + inputDetails.regex);
            fakeAnswerService.recordFailedRegex(inputDetails);
            answer.answer = '';
            return false;
        }

            const numberOfWords = utilsService.getRandomInt(10);
            let randomPhrase = '';

            //add random words
            for (let i = 0; i < numberOfWords; i++) {
                const language = languagesArrays[utilsService.getRandomInt(languagesArrays.length)];
                randomPhrase += ' ' + language[utilsService.getRandomInt(language.length)] + '';
            }

            randomPhrase += ' ' + symbolsArray[utilsService.getRandomInt(symbolsArray.length)];

            //sanitise < and > replacing by Unicode (this is here for testing)
            randomPhrase = randomPhrase.replaceAll('>', '\ufe65');
            randomPhrase = randomPhrase.replaceAll('<', '\ufe64');
            //"\ufe64 \ufe65", < >

            answer.answer = (entryIndex + randomPhrase).trim();
    },
    async createFakeAnswer(inputDetails, entry, entryIndex) {
        return new Promise((resolve) => {
            (async () => {
            const rootStore = useRootStore();
            const answer = { was_jumped: false };
            let random_idx;

            const min = 0.0200;
            const max = 10.120;

            function randomDate(backTo) {
                // var date = new Date(+start + Math.random() * (end - start));
                // var hour = startHour + Math.random() * (endHour - startHour) | 0;
                // date.setHours(hour);
                // return date;
                const d = new Date(); // today!
                const x = Math.floor((Math.random() * backTo) + 1); // go back x days!
                d.setDate(d.getDate() - x);
                return d.toISOString();
            }

            function randomIntegerInRange(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }

            const languagesArrays = [wordsSpanish, wordsEnglish, wordsGerman];
            const symbolsArray = ['!', '@', '€', '£', '#', '$', '%', '^', '&', '*', '"', '\'', '\\', '{', ',', '.', '?', '|', '<', '>', '~', '`'];

            switch (inputDetails.type) {
                case 'text':
                    await fakeAnswerService.generateTextAnswer(inputDetails, answer, languagesArrays, symbolsArray, entryIndex);
                    //imp: truncate to 255 as per epicollect limits
                    answer.answer = utilsService.trunc(answer.answer, 255, false);
                    resolve(answer);
                    break;
                case 'textarea':
                    await fakeAnswerService.generateTextAnswer(inputDetails, answer, languagesArrays, symbolsArray, entryIndex);
                    resolve(answer);
                    break;
                case 'integer':
                case 'phone':
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
                                const generated = await generateFromRegex(inputDetails.regex, true);
                                if (generated !== null) {
                                    answer.answer = generated;
                                    console.log('regex integer/phone ->', answer.answer, inputDetails.regex);
                                } else {
                                    //no verified candidate: leave empty so it
                                    //saves locally and skips the server check
                                    console.warn('regex not supported for fake generation, leaving empty -> ' + inputDetails.regex);
                                    fakeAnswerService.recordFailedRegex(inputDetails);
                                    answer.answer = '';
                                }
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
                case 'dropdown': {
                    const paLen = inputDetails.possible_answers.length;
                    random_idx = Math.floor((Math.random() * paLen));
                    answer.answer = inputDetails.possible_answers[random_idx].answer_ref;
                    resolve(answer);
                    break;
                }
                case 'checkbox':
                case 'searchsingle':
                case 'searchmultiple': {
                    const paLen = inputDetails.possible_answers.length;
                    random_idx = Math.floor((Math.random() * paLen));
                    answer.answer = [];
                    answer.answer.push(inputDetails.possible_answers[random_idx].answer_ref);
                    resolve(answer);
                    break;
                }
                case 'barcode':
                    answer.answer = 'xxxxx-xxxx-xxx'.replace(/[xy]/g, function (c) {
                        // Use Math.floor to get an integer between 0 and 15
                        const r = Math.floor(Math.random() * 16);
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    resolve(answer);
                    break;

                case 'location': {
                    //Mirko Locations (whole world range are -170 + 170 for long, -80 +80 for lat, considering a bit of padding)
                    //please amend accordingly
                    const lat = utilsService.getRandomInRange(-80, 80, 5);
                    const long = utilsService.getRandomInRange(-160, 160, 5);
                    answer.answer = utilsService.getRandomLocation(lat, long);
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
                            fakeFilePhotoService.createFile(entry, 'photo').then(function (filename) {
                                answer.answer = filename;

                                //save file metadata to media table
                                const media = {
                                    cached: '',
                                    stored: filename,
                                    entry_uuid: entry.entryUuid,
                                    input_ref: inputDetails.ref,
                                    type: 'photo'
                                };

                                databaseInsertService.insertMedia(entry, [media], PARAMETERS.SYNCED_CODES.UNSYNCED).then(function (response) {
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

                case 'audio':
                    if (rootStore.device.platform !== PARAMETERS.WEB) {
                        window.setTimeout(function () {
                            //generate a fake file and save it
                            fakeFileAudioService.createFile(entry, 'audio').then(function (filename) {
                                answer.answer = filename;

                                //save file metadata to media table
                                const media = {
                                    cached: '',
                                    stored: filename,
                                    entry_uuid: entry.entryUuid,
                                    input_ref: inputDetails.ref,
                                    type: 'audio'
                                };

                                databaseInsertService.insertMedia(entry, [media], PARAMETERS.SYNCED_CODES.UNSYNCED).then(function (response) {
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

                case 'video':
                    if (rootStore.device.platform !== PARAMETERS.WEB) {
                        window.setTimeout(function () {
                            //generate a fake file and save it
                            fakeFileVideoService.createFile(entry, 'video').then(function (filename) {
                                answer.answer = filename;

                                //save file metadata to media table
                                const media = {
                                    cached: '',
                                    stored: filename,
                                    entry_uuid: entry.entryUuid,
                                    input_ref: inputDetails.ref,
                                    type: 'video'
                                };

                                databaseInsertService.insertMedia(entry, [media], PARAMETERS.SYNCED_CODES.UNSYNCED).then(function (response) {
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
            })();
        });
    }
};
