import {useRootStore} from '@/stores/root-store';
import {projectModel} from '@/models/project-model.js';
import {PARAMETERS} from '@/config';
import {Capacitor} from '@capacitor/core';
import {databaseSelectService} from '@/services/database/database-select-service';
import {utilsService} from '@/services/utilities/utils-service';
import Papa from 'papaparse';
import {fromLatLon} from 'utm'; // Import the specific function
/**
 * PRIVATE HELPERS
 */
function _getLegacyPlatform() {
    const rootStore = useRootStore();
    const platform = Capacitor.isNativePlatform() ? rootStore.device.platform : PARAMETERS.WEB;
    const mapping = {
        [PARAMETERS.ANDROID]: PARAMETERS.LEGACY_ANDROID,
        [PARAMETERS.IOS]: PARAMETERS.LEGACY_IOS
    };
    return mapping[platform] || PARAMETERS.LEGACY_WEB;
}

function _makeJsonEntry(entry) {
    const rootStore = useRootStore();
    const entryType = entry.entry_type;
    const entryJson = {
        type: entryType,
        id: entry.entry_uuid,
        attributes: {form: {ref: entry.form_ref, type: 'hierarchy'}},
        relationships: {
            parent: entry.parent_entry_uuid ? {
                data: {parent_form_ref: entry.parent_form_ref, parent_entry_uuid: entry.parent_entry_uuid}
            } : {},
            branch: entry.owner_entry_uuid ? {
                data: {owner_input_ref: entry.owner_input_ref, owner_entry_uuid: entry.owner_entry_uuid}
            } : {}
        }
    };
    try {
        entryJson[entryType] = {
            entry_uuid: entry.entry_uuid,
            created_at: entry.created_at,
            device_id: entry.device_id,
            platform: entry.platform,
            title: entry.title,
            answers: typeof entry.answers === 'string' ? JSON.parse(entry.answers) : entry.answers,
            project_version: entry.last_updated
        };
        if (rootStore.isPWA) {
            entryJson[entryType].files_to_delete = rootStore.queueRemoteFilesToDeletePWA;
        }
    } catch (e) {
        entryJson[entryType] = {};
    }
    return entryJson;
}

/**
 * MAIN SERVICE
 */
export const JSONTransformerService = {

    makeJsonEntry(entryType, entry) {
        const rootStore = useRootStore();
        entry.last_updated = projectModel.getLastUpdated();
        entry.device_id = rootStore.isPWA ? '' : rootStore.device.identifier;
        entry.platform = _getLegacyPlatform();
        entry.entry_type = entryType;
        return _makeJsonEntry(entry);
    },

    makeJsonFileEntry(file) {
        file.structure_last_updated = projectModel.getLastUpdated();
        file.platform = _getLegacyPlatform();
        const rootStore = useRootStore();
        return {
            type: 'file_entry',
            id: file.entry_uuid,
            attributes: {form: {ref: file.form_ref, type: 'hierarchy'}},
            relationships: {parent: {}, branch: {}},
            file_entry: {
                entry_uuid: file.entry_uuid,
                name: file.file_name,
                type: file.file_type,
                input_ref: file.input_ref,
                project_version: file.structure_last_updated,
                created_at: file.created_at || new Date().toISOString(),
                device_id: rootStore.device.identifier,
                platform: file.platform
            }
        };
    },

    flattenJsonEntry(entry, canEdit, isRemote) {
        return {
            entryUuid: entry.id,
            parentEntryUuid: entry.relationships.parent.data?.parent_entry_uuid || '',
            projectRef: entry.projectRef,
            formRef: entry.attributes.form.ref,
            parentFormRef: entry.relationships.parent.data?.parent_form_ref || '',
            answers: entry[entry.type].answers,
            synced: 1,
            synced_error: '',
            canEdit: canEdit,
            isRemote: isRemote,
            createdAt: entry[entry.type].created_at,
            updatedAt: entry[entry.type].created_at,
            title: entry[entry.type].title,
            titles: JSON.stringify({})
        };
    },

    /**
     * CSV HEADER METHODS
     */
    getFormCSVHeaders(form, mappings, isGroup, formIndex, isBranch) {
        const headers = isGroup ? form.headers : ['ec5_uuid', 'created_at', 'title'];
        const formRef = form.details.ref;
        const defaultMapping = mappings.find((m) => m.is_default);

        if (formIndex > 0 && !isGroup) {
            headers.splice(1, 0, 'parent_entry_uuid');
        }

        form.inputs.forEach((inputRef) => {

            const inputDetails = projectModel.getInput(inputRef);

            if (inputDetails.type === PARAMETERS.QUESTION_TYPES.README) {
                return;
            }

            let mapTo;
            if (isBranch) {
                // Direct branch input: forms[formRef][branchOwnerInputRef].branch[inputRef].map_to
                mapTo = defaultMapping.forms[formRef][form.details.ownerInputRef].branch[inputDetails.ref]?.map_to;
            } else if (isGroup) {
                if (form.branchOwnerInputRef) {
                    // Group nested inside a branch:
                    // forms[formRef][branchOwnerInputRef].branch[groupRef].group[inputRef].map_to
                    mapTo = defaultMapping.forms[formRef][form.branchOwnerInputRef].branch[form.groupRef].group[inputDetails.ref]?.map_to;
                } else {
                    // Plain group: forms[formRef][groupRef].group[inputRef].map_to
                    mapTo = defaultMapping.forms[formRef][form.groupRef].group[inputDetails.ref]?.map_to;
                }
            } else {
                mapTo = defaultMapping.forms[formRef][inputDetails.ref]?.map_to;
            }

            switch (inputDetails.type) {
                case PARAMETERS.QUESTION_TYPES.LOCATION:
                    headers.push(`lat_${mapTo}`, `long_${mapTo}`, `acc_${mapTo}`, `UTM_Northing_${mapTo}`, `UTM_Easting_${mapTo}`, `UTM_Zone_${mapTo}`);
                    break;
                case PARAMETERS.QUESTION_TYPES.BRANCH:
                    headers.push(mapTo);
                    break;

                case PARAMETERS.QUESTION_TYPES.GROUP: {
                    const groupInputs = projectModel.getGroupInputRefs(formRef, inputDetails.ref);
                    this.getGroupCSVHeaders(form, groupInputs, mappings, inputDetails.ref, headers);
                    break;
                }
                default:
                    headers.push(mapTo);
            }
        });

        if (isGroup || isBranch) return headers;
        return Papa.unparse([headers], {header: false, quotes: false});
    },

    getGroupCSVHeaders(form, groupInputs, mappings, groupRef, headers) {
        const newForm = {
            details: { ref: form.details.ref },
            inputs: groupInputs,
            groupRef,
            headers,
            branchOwnerInputRef: form.details.ownerInputRef || form.branchOwnerInputRef || null
            // ^^^ only set when coming from a branch context
        };
        return this.getFormCSVHeaders(newForm, mappings, true, 1, false);
    },

    getBranchCSVHeaders(branch, mappings) {
        const projectExtra = projectModel.getProjectExtra();
        const branchInputsRefs = Object.values(projectExtra.forms)
            .find((f) => f.branch[branch.branchRef])?.branch[branch.branchRef] || [];

        const formFromBranch = {
            details: {
                ref: branch.formRef,
                ownerInputRef: branch.branchRef
            },
            inputs: branchInputsRefs
        };

        const headersArray = this.getFormCSVHeaders(formFromBranch, mappings, false, 0, true);
        headersArray.splice(0, 1, 'ec5_branch_owner_uuid', 'ec5_branch_uuid');
        return Papa.unparse([headersArray], {header: false, quotes: false});
    },

    /**
     * CSV ROW METHODS
     */
    async getFormCSVRow(entry, form, answers, isGroup, isBranch) {
        let row = isGroup ? [...form.row] : [entry.entry_uuid, entry.created_at, entry.title];

        if (entry.parent_entry_uuid && !isGroup) {
            row.splice(1, 0, entry.parent_entry_uuid);
        }

        const QT = PARAMETERS.QUESTION_TYPES;

        for (const inputRef of form.inputs) {
            const inputDetails = projectModel.getInput(inputRef);
            if (inputDetails.type === QT.README) continue;
            const answer = answers[inputRef]?.answer ?? '';

            switch (inputDetails.type) {
                case QT.LOCATION:
                    // Check for null/undefined specifically, allowing 0
                    if (answer?.latitude !== null && answer?.latitude !== undefined &&
                        answer?.longitude !== null && answer?.longitude !== undefined) {

                        const utmRes = this.utmConverter(answer.latitude, answer.longitude);
                        row.push(answer.latitude, answer.longitude, answer.accuracy, utmRes.northing, utmRes.easting, utmRes.zone);
                    } else {
                        row.push('', '', '', '', '', '');
                    }
                    break;
                case QT.DATE:
                    row.push(answer ? utilsService.getUserFormattedDate(answer, inputDetails.datetime_format) : '');
                    break;
                case QT.TIME:
                    row.push(answer ? utilsService.getUserFormattedTime(answer, inputDetails.datetime_format) : '');
                    break;
                case QT.DROPDOWN:
                case QT.RADIO: {
                    const match = inputDetails.possible_answers?.find((pa) => pa.answer_ref === answer);
                    row.push(match ? match.answer : '');
                    break;
                }
                case QT.CHECKBOX:
                case QT.SEARCH_SINGLE:
                case QT.SEARCHMULTIPLE: {
                    if (Array.isArray(answer) && answer.length > 0) {
                        const labels = answer
                            .map((ref) => inputDetails.possible_answers?.find((pa) => pa.answer_ref === ref)?.answer)
                            .filter(Boolean);
                        row.push(labels.join(', '));
                    } else {
                        row.push('');
                    }
                    break;
                }
                case QT.GROUP: {
                    const groupInputs = projectModel.getGroupInputRefs(form.details.ref, inputDetails.ref);
                    row = await this.getGroupCSVRow(form, entry, groupInputs, answers, row);
                    break;
                }
                case QT.BRANCH: {
                    const result = await databaseSelectService.countBranchesForQuestion(
                        entry.entry_uuid,
                        inputDetails.ref,
                        null,
                        null
                    );
                    row.push(result.rows.item(0).total.toString());
                    break;
                }
                default:
                    row.push(answer !== null && answer !== undefined ? answer.toString().trim() : '');
            }
        }

        if (isGroup || isBranch) return row;
        return Papa.unparse([row], {header: false, quotes: false});
    },

    async getGroupCSVRow(form, entry, groupInputs, answers, row) {
        const newForm = {
            details: {
                ref: form.details.ref,
                ownerInputRef: form.details.ownerInputRef
            },
            inputs: groupInputs,
            row
        };
        return await this.getFormCSVRow(entry, newForm, answers, true);
    },

    async getBranchCSVRow(entry, branch, answers) {
        const projectExtra = projectModel.getProjectExtra();
        const branchInputsRefs = Object.values(projectExtra.forms)
            .find((f) => f.branch[branch.branchRef])?.branch[branch.branchRef] || [];

        const formFromBranch = {
            details: {
                ref: branch.formRef,
                ownerInputRef: branch.branchRef
            },
            inputs: branchInputsRefs

        };

        const rowArray = await this.getFormCSVRow(entry, formFromBranch, answers, false, true);
        rowArray.unshift(entry.owner_entry_uuid);
        return Papa.unparse([rowArray], {header: false, quotes: false});
    },

    /**
     * UTILITY METHODS
     */
    utmConverter(lat, lon) {
        try {
            // Ensure values are numbers
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);

            // The 'utm' package expects (lat, lon)
            const result = fromLatLon(latitude, longitude);

            return {
                easting: Math.floor(result.easting),
                northing: Math.floor(result.northing),
                // Use the correct property names: zoneNum and zoneLetter
                zone: `${result.zoneNum}${result.zoneLetter}`
            };
        } catch (e) {
            console.error('UTM Conversion Error:', e);
            return { easting: '', northing: '', zone: '' };
        }
    },

    makeUniqueEntry(formRef, entry, inputRef, answer, projectVersion) {
        const entryType = entry.isBranch ? PARAMETERS.BRANCH_ENTRY : PARAMETERS.ENTRY;
        return {
            id: entry.entryUuid,
            type: entryType,
            attributes: {form: {ref: formRef, type: 'hierarchy'}},
            relationships: {
                parent: entry.parentEntryUuid ? {
                    data: {parent_form_ref: entry.parentFormRef, parent_entry_uuid: entry.parentEntryUuid}
                } : {},
                branch: entry.ownerEntryUuid ? {
                    data: {owner_input_ref: entry.ownerInputRef, owner_entry_uuid: entry.ownerEntryUuid}
                } : {}
            },
            [entryType]: {
                entry_uuid: entry.entryUuid,
                input_ref: inputRef,
                answer,
                project_version: projectVersion,
                platform: _getLegacyPlatform()
            }
        };
    }
};
