import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import * as services from '@/services';
import proj4 from 'proj4';
import { Capacitor } from '@capacitor/core';

/**
* Make the json entry object
* @returns {{type: *, id: *, attributes: {form: {ref: *, type: string}}, relationships: {parent: {}, branch: {}}}}
*/
function _makeJsonEntry (entry) {

    const rootStore = useRootStore();

    let branch = {};
    let parent = {};

    // If this entry has a parent
    if (entry.parent_entry_uuid) {
        parent = {
            data: {
                parent_form_ref: entry.parent_form_ref,
                parent_entry_uuid: entry.parent_entry_uuid
            }
        };
    }

    if (entry.owner_entry_uuid) {
        branch = {
            data: {
                owner_input_ref: entry.owner_input_ref,
                owner_entry_uuid: entry.owner_entry_uuid
            }
        };
    }

    const entryJson = {
        type: entry.entry_type,
        id: entry.entry_uuid,
        attributes: {
            form: {
                ref: entry.form_ref,
                type: 'hierarchy'
            }
        },
        relationships: {
            parent: parent,
            branch: branch
        }
    };

    try {
        entryJson[entry.entry_type] = {
            entry_uuid: entry.entry_uuid,
            created_at: entry.created_at,
            device_id: entry.device_id,
            platform: entry.platform,
            title: entry.title,
            answers: JSON.parse(entry.answers),
            project_version: entry.last_updated
        };

        if (rootStore.isPWA) {
            entryJson[entry.entry_type].files_to_delete = rootStore.queueRemoteFilesToDeletePWA;
        }
    } catch (e) {
        // Failed - just reset the answers
        entryJson[entry.entry_type] = {};
    }

    return entryJson;
}

/**
* Make the json file entry object
* @returns {{type: string, id: *, entry_uuid: *, attributes: {form: {ref: *, type: string}}, relationships: {parent: {}, branch: {}}, file: {name: *, type: *, input_ref: *}, structure_last_updated: string}}
*/
function _makeJsonFileEntry (file) {

    return {
        type: 'file_entry',
        id: file.entry_uuid,
        attributes: {
            form: {
                ref: file.form_ref,
                type: 'hierarchy'
            }
        },
        relationships: {
            parent: {},
            branch: {}
        },
        file_entry: {
            entry_uuid: file.entry_uuid,
            name: file.file_name,
            type: file.file_type,
            input_ref: file.input_ref,
            project_version: file.structure_last_updated,
            created_at: file.created_at || new Date().toISOString(),
            device_id: file.device_id || '',
            platform: file.platform || ''
        }
    };
}


/**
 * Utilities JSON Formatter Service - for formatting to/from JSON
 */
export const JSONTransformerService = {
    /**
     * Make the json entry object
     * @returns {{type: string, id: *, entry_uuid: *, attributes: {form: {ref: *, type: string}}, relationships: {parent: {}, branch: {}}, created_at: *, device_id: string, jwt: *}}
     */
    makeJsonEntry (entryType, entry) {

        const rootStore = useRootStore();
        // Add extra properties needed by the json formatter
        entry.last_updated = projectModel.getLastUpdated();

        //device id not needed for PWA (always logged in so user ID is used instead)
        if (rootStore.isPWA) {
            entry.device_id = '';
        }
        else {
            //on native platforms use unique device identifier
            entry.device_id = rootStore.device.uuid;
        }

        //upload as WEB when using the PWA, otherwise ANDROID or IOS
        entry.platform = Capacitor.isNativePlatform()
            ? entry.platform = rootStore.device.platform
            : entry.platform = PARAMETERS.WEB;

        // hack: tweak platform casing for legacy reasons 
        //(match existing config on epicollect servers)
        switch (entry.platform) {
            case PARAMETERS.ANDROID:
                entry.platform = PARAMETERS.LEGACY_ANDROID;
                break;
            case PARAMETERS.IOS:
                entry.platform = PARAMETERS.LEGACY_IOS;
                break;
            default:
                entry.platform = PARAMETERS.LEGACY_WEB;
        }


        entry.entry_type = entryType;

        return _makeJsonEntry(entry);
    },

    /**
     * Make the json file entry object
     *
     * @param file
     * @returns {{type: string, id: *, entry_uuid: *, attributes: {form: {ref: *, type: string}}, relationships: {parent: {}, branch: {}}, created_at: number, device_id: string, file: {name: *, type: *, input_ref: *}}}
     */
    makeJsonFileEntry (file) {

        const rootStore = useRootStore();
        // Add extra properties needed by the json formatter
        file.structure_last_updated = projectModel.getLastUpdated();
        file.device_id = rootStore.device.uuid;

        //upload as WEB when using the PWA, otherwise ANDROID or IOS
        file.platform = Capacitor.isNativePlatform()
            ? rootStore.device.platform
            : file.platform = PARAMETERS.WEB;

        // hack: tweak platform casing for legacy reasons 
        //(match existing config on epicollect servers)    
        switch (file.platform) {
            case PARAMETERS.ANDROID:
                file.platform = PARAMETERS.LEGACY_ANDROID;
                break;
            case PARAMETERS.IOS:
                file.platform = PARAMETERS.LEGACY_IOS;
                break;
            default:
                file.platform = PARAMETERS.LEGACY_WEB;
        }

        return _makeJsonFileEntry(file);

    },

    /**
     * Create a flattened entry format
     */
    flattenJsonEntry (entry, canEdit, isRemote) {
        return {
            entryUuid: entry.id,
            parentEntryUuid: entry.relationships.parent.data ? entry.relationships.parent.data.parent_entry_uuid : '',
            projectRef: entry.projectRef,
            formRef: entry.attributes.form.ref,
            parentFormRef: entry.relationships.parent.data ? entry.relationships.parent.data.parent_form_ref : '',
            answers: entry.entry.answers,
            synced: 1,//synced
            synced_error: '',//synced_error
            canEdit: canEdit,//can_edit
            isRemote: isRemote,//is_remote
            createdAt: entry.entry.created_at,
            updatedAt: entry.entry.created_at,
            title: entry.entry.title,
            titles: JSON.stringify({})

        };
    },

    getBranchCSVHeaders (branch, mappings) {

        const projectExtra = projectModel.getProjectExtra();
        //remap branch here like it was a form object, to re-use getFormCSVHeaders()
        const formFromBranch = {
            details: {
                ref: branch.formRef,
                inputs: [],//inject the branch inputs here
                ownerInputRef: branch.branchRef
            }
        };
        //get all branch input refs
        let branchInputsRefs;
        Object.values(projectExtra.forms).every((form) => {
            if (form.branch[branch.branchRef]) {
                branchInputsRefs = form.branch[branch.branchRef];
                return false;
            }
            return true;
        });
        //loop all ref to build our re-mapped branch object
        branchInputsRefs.forEach((branchInputRef) => {
            formFromBranch.details.inputs.push(projectExtra.inputs[branchInputRef].data);
        });
        //get branch headers re-using getFormCSVHeaders()
        const headers = this.getFormCSVHeaders(formFromBranch, mappings, false, 0, true);
        //it is a branch, so insert needed headers
        headers.splice(0, 1, ...['ec5_branch_owner_uuid', 'ec5_branch_uuid']);
        //finally return them 
        return headers;
    },

    getFormCSVHeaders (form, mappings, isGroup, formIndex, isBranch) {

        //console.log('mapping ->', JSON.stringify(mappings));
        const headers = isGroup ? form.headers : ['ec5_uuid', 'created_at', 'title'];
        const formRef = form.details.ref;

        const defaultMapping = mappings.filter((mapping) => {
            if (mapping.is_default) {
                return mapping.forms;
            }
        });

        if (formIndex > 0 && !isGroup) {
            //this is a child form, needs the parent_entry_uuid header
            headers.splice(1, 0, 'parent_entry_uuid');
        }

        form.details.inputs.forEach((input) => {

            //skip readme, they do not get a header
            if (input.type !== PARAMETERS.QUESTION_TYPES.README) {
                // console.log(input, defaultMapping);

                // console.log(JSON.stringify(input));
                // console.log(JSON.stringify(defaultMapping));

                // console.log('****************************');


                let mapTo;
                if (isBranch) {
                    //target current branch -> forms[formRef][ownerInputRef].branch
                    const ownerInputRef = form.details.ownerInputRef;
                    mapTo = defaultMapping[0].forms[formRef][ownerInputRef].branch[input.ref]?.map_to;
                }
                else {
                    //hierarchy inputs
                    if (isGroup) {
                        const groupRef = form.groupRef;
                        mapTo = defaultMapping[0].forms[formRef][groupRef].group[input.ref]?.map_to;
                    }
                    else {
                        mapTo = defaultMapping[0].forms[formRef][input.ref]?.map_to;
                    }
                }

                switch (input.type) {
                    case PARAMETERS.QUESTION_TYPES.LOCATION:
                        headers.push('lat_' + mapTo);
                        headers.push('long_' + mapTo);
                        headers.push('acc_' + mapTo);
                        headers.push('UTM_Northing_' + mapTo);
                        headers.push('UTM_Easting_' + mapTo);
                        headers.push('UTM_Zone_' + mapTo);
                        break;
                    case PARAMETERS.QUESTION_TYPES.README:
                        //skip readme
                        break;
                    case PARAMETERS.QUESTION_TYPES.BRANCH:
                        // branch types just add the header 
                        //(on the server the branches count is provided as answers)
                        //on the mobiel apps, we leave that value empty
                        headers.push(mapTo);
                        break;
                    case PARAMETERS.QUESTION_TYPES.GROUP: {
                        //groups are flatten so we need all the headers
                        const groupHeaders = this.getGroupCSVHeaders(formRef, input.group, mappings, input.ref, headers);
                        headers.concat(groupHeaders);
                        break;
                    }
                    default:
                        headers.push(mapTo);
                }
            }
        });
        // console.log('headers ---->', headers);
        return headers;
    },

    //get group inputs headers
    getGroupCSVHeaders (formRef, groupInputs, mappings, groupRef, headers) {
        //we can convert the group to a form-like object
        //and re-use getFormCSVHeaders();
        const form = {
            details: {
                ref: formRef,
                inputs: groupInputs
            },
            groupRef,
            headers
        };
        //pass 1 as formIndex to avoid having the extra header,
        // the isGroup flag makes it useless anyway
        return (this.getFormCSVHeaders(form, mappings, true, 1, false));
    },

    async getFormCSVRow (entry, form, answers, isGroup) {

        const row = isGroup ? form.row : [entry.entry_uuid, entry.created_at, entry.title];
        const branches = [];
        if (entry.parent_entry_uuid && !isGroup) {
            //this is a child form, needs the entry.parent_entry_uuid
            row.splice(1, 0, entry.parent_entry_uuid);
        }

        form.details.inputs.forEach(async (input, inputIndex) => {
            //skip readme, they do not get an answer
            if (input.type !== PARAMETERS.QUESTION_TYPES.README) {

                let answer = '';

                // first check if the question for this answer exists in the form, 
                //project updates can remove existing questions
                if (answers[input.ref] !== undefined) {
                    answer = answers[input.ref].answer;
                }
                switch (input.type) {
                    case PARAMETERS.QUESTION_TYPES.DATE: {
                        const format = input.datetime_format;
                        if (answer === '') {
                            row.push('');
                        } else {
                            row.push(services.utilsService.getUserFormattedDate(answer, format));
                        }
                        break;
                    }
                    case PARAMETERS.QUESTION_TYPES.TIME: {
                        const format = input.datetime_format;
                        if (answer === '') {
                            row.push('');
                        } else {
                            row.push(services.utilsService.getUserFormattedTime(answer, format));
                        }
                        break;
                    }
                    case PARAMETERS.QUESTION_TYPES.LOCATION: {
                        if (answer.latitude && answer.longitude) {
                            const utm = this.utmConverter(answer.latitude, answer.longitude);
                            row.push(answer.latitude.toString());
                            row.push(answer.longitude.toString());
                            row.push(answer.accuracy.toString());
                            row.push(utm.northing.toString());
                            row.push(utm.easting.toString());
                            row.push(utm.zone);
                        }
                        else {
                            row.push('');
                            row.push('');
                            row.push('');
                            row.push('');
                            row.push('');
                            row.push('');
                        }
                        break;
                    }
                    case PARAMETERS.QUESTION_TYPES.DROPDOWN:
                    case PARAMETERS.QUESTION_TYPES.RADIO:
                        //map single possible answer (answer is text)
                        input.possible_answers.every((possibleAnswer) => {
                            if (possibleAnswer.answer_ref === answer) {
                                if (answer.includes(',')) {
                                    row.push('"' + possibleAnswer.answer + '"');
                                }
                                else {
                                    row.push(possibleAnswer.answer);
                                }
                                return false;//exit the loop
                            }
                            return true;//keep going
                        });
                        break;
                    case PARAMETERS.QUESTION_TYPES.CHECKBOX:
                    case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
                    case PARAMETERS.QUESTION_TYPES.SEARCHMULTIPLE: {
                        //map multiple possible answers (answer is array)
                        const rawAnswers = [];
                        if (answer.length > 0) {
                            // const wrappedAnswers =[];
                            answer.forEach((value) => {
                                input.possible_answers.every((possibleAnswer) => {
                                    if (possibleAnswer.answer_ref === value) {
                                        rawAnswers.push(possibleAnswer.answer);
                                        return false;//exit loop
                                    }
                                    return true;//keep going
                                });
                            });

                            //wrap answers in quotes if they have commas
                            const wrappedAnswers = rawAnswers.map((answer) => {
                                if (answer.includes(',')) {
                                    return '"' + answer + '"';
                                }
                                return answer;
                            });

                            row.push(wrappedAnswers.join(', '));
                        }
                        else {
                            row.push('');
                        }
                        break;
                    }
                    case PARAMETERS.QUESTION_TYPES.GROUP: {

                        //groups are flatten so we need all the headers
                        const groupRow = this.getGroupCSVRow(entry, input.group, answers, row);
                        row.concat(groupRow);
                        break;
                    }
                    case PARAMETERS.QUESTION_TYPES.README:
                        //skip readme
                        break;
                    case PARAMETERS.QUESTION_TYPES.BRANCH: {
                        //branch types, add count (local)

                        branches.push({
                            ownerEntryUuid: entry.entry_uuid,
                            inputRef: input.ref,
                            inputIndex
                        });
                        break;
                    }
                    default:
                        //1 - always convert to String (this is for numeric questions)
                        //2 - trim() whitespaces and new lines
                        //3 - if the answer includes commas, wrap in quotes as per csv specs
                        answer = answer.toString().trim();
                        if (answer.includes(',')) {
                            row.push('"' + answer + '"');
                        }
                        else {
                            row.push(answer);
                        }
                }
            }
        });

        let branchesCounts;
        //if any branches, grab the counts (async)
        if (branches.length > 0) {
            branchesCounts = await Promise.all(branches.map(async (branch) => {
                const result = await services.databaseSelectService.countBranchesForQuestion(branch.ownerEntryUuid, branch.inputRef, null, null);

                //shift position by metadata columns
                let shiftBy = 3;//parent form -> [entry_uuid, created_at, title]
                if (entry.parent_entry_uuid && !isGroup) {
                    //this is a child form, shift one more -> [parent_entry_uuid]
                    shiftBy++;
                }
                return {
                    total: (result.rows.item(0).total).toString(),
                    placeAtIndex: branch.inputIndex + shiftBy
                };
            }));

            //inject the counts at the right position
            branchesCounts.forEach((branchCount) => {
                row.splice(branchCount.placeAtIndex, 0, branchCount.total);
            });
        }

        console.log('row ----->', row);
        return row;
    },

    async getBranchCSVRow (entry, branch, answers, isGroup) {

        const projectExtra = projectModel.getProjectExtra();
        const formRef = branch.formRef;

        //remap branch here like it was a form object, to re-use getFormCSVRow()
        const formFromBranch = {
            details: {
                ref: formRef,
                inputs: [],//inject the branch inputs here
                ownerInputRef: branch.branchRef
            }
        };
        //get all branch input refs
        let branchInputsRefs;
        Object.values(projectExtra.forms).every((form) => {
            if (form.branch[branch.branchRef]) {
                branchInputsRefs = form.branch[branch.branchRef];
                return false;
            }
            return true;
        });
        //loop all ref to build our re-mapped branch object
        branchInputsRefs.forEach((branchInputRef) => {
            formFromBranch.details.inputs.push(projectExtra.inputs[branchInputRef].data);
        });

        //get row of data for this branch
        const branchRow = await this.getFormCSVRow(entry, formFromBranch, answers, isGroup);
        //console.log(branchRow);

        //todo: need to add owner_entry_uuid for branches
        branchRow.unshift(entry.owner_entry_uuid);

        return branchRow;
    },
    //we pass "row" wich contains the row of answers so far
    getGroupCSVRow (entry, groupInputs, answers, row) {
        const form = {
            details: {
                inputs: groupInputs
            },
            row
        };
        //pass 1 as formIndex to avoid having the extra header,
        // the isGroup flag makes it useless anyway
        return this.getFormCSVRow(entry, form, answers, true, 1);
    },
    //https://www.maptools.com/tutorials/utm/quick_guide
    //https://stackoverflow.com/questions/9186496/determining-utm-zone-to-convert-from-longitude-latitude
    // https://stackoverflow.com/questions/29655256/proj4js-can-you-convert-a-lat-long-to-utm-without-a-zone
    utmConverter (lat, long) {
        //get utm-zone from longitude degrees
        function getUTMZone (lat, long) {
            //Special Cases for Norway and Svalbard
            if (lat > 55 && lat < 64 && long > 2 && long < 6) {
                return 32;
            }
            if (lat > 71 && long >= 6 && long < 9) {
                return 31;
            }
            if (lat > 71 && ((long >= 9 && long < 12) || (long >= 18 && long < 21))) {
                return 33;
            }
            if (lat > 71 && ((long >= 21 && long < 24) || (long >= 30 && long < 33))) {
                return 35;
            }

            //rest of the world    
            return parseInt(((long + 180) / 6) % 60) + 1;
        }

        function proj4_setdef (lat, long) {
            //get UTM projection definition from longitude
            const utm_zone = getUTMZone(lat, long);
            const zdef = `+proj=utm +zone=${utm_zone} +datum=WGS84 +units=m +no_defs`;
            return zdef;
        }

        // console.log('Input (long,lat):', long, lat);
        const zone = getUTMZone(lat, long);
        // console.log(`UTM zone from longitude: ${zone}`);
        // console.log('AUTO projection definition:', proj4_setdef(long));

        // define proj4_defs for easy uses
        // 'EPSG:4326' for long/lat degrees, no projection
        // 'EPSG:AUTO' for UTM 'auto zone' projection
        proj4.defs([
            [
                'EPSG:4326',
                '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'
            ],
            ['EPSG:AUTO', proj4_setdef(lat, long)]]);

        // usage:
        // conversion from (long/lat) to UTM (E/N)
        const en_m = proj4('EPSG:4326', 'EPSG:AUTO', [long, lat]);
        //IMP: we use floor to match (as much as possible) the PHP UTM conversion on server
        const easting = Math.floor(en_m[0]); //easting
        const northing = Math.floor(en_m[1]); //northing
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        // console.log(`Zone ${zone}, (E,N) m: ${easting}, ${northing}`);

        let index;
        if (lat > -80 && lat < 72) {
            index = Math.floor((lat + 80) / 8) + 2;
        }
        if (lat > 72 && lat < 84) {
            index = 21;
        }
        if (lat > 84) {
            index = 23;
        }
        const letter = letters.charAt(index);

        // inversion from (E,N) to (long,lat)
        const lonlat_chk = proj4('EPSG:AUTO', 'EPSG:4326', en_m);
        //console.log('Inverse check:', lonlat_chk);
        // console.log('UTM: ', northing, easting, zone + letter);
        return {
            northing,
            easting,
            zone: zone + letter
        };
    },
    //Create a json object used in the api uniqueness check
    makeUniqueEntry (formRef, entry, inputRef, answer, projectVersion) {
        const relationships = {
            parent: {},
            branch: {}
        };

        // If this entry has a parent
        if (entry.parent_entry_uuid) {
            relationships.parent = {
                data: {
                    parent_form_ref: entry.parent_form_ref,
                    parent_entry_uuid: entry.parent_entry_uuid
                }
            };
        }

        if (entry.owner_entry_uuid) {
            relationships.branch = {
                data: {
                    owner_input_ref: entry.owner_input_ref,
                    owner_entry_uuid: entry.owner_entry_uuid
                }
            };
        }


        return {
            id: entry.entryUuid,
            type: 'entry',
            attributes: {
                form: {
                    ref: formRef,
                    type: 'hierarchy'
                }
            },
            relationships,
            entry: {
                entry_uuid: entry.entryUuid,
                input_ref: inputRef,
                answer,
                project_version: projectVersion
            }
        };
    }
};



