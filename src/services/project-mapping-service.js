/**
 * projectMappingService.js
 *
 * Ionic/Vue (plain JavaScript) port of the PHP ProjectMappingService.
 *
 * Generates the EC5_AUTO project mapping from a project_extra structure
 * (produced by projectExtraService.js).
 *
 * Usage:
 *   import projectMappingService from '@/services/projectMappingService'
 *   const mapping = projectMappingService.createEC5AUTOMapping(projectExtra)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mirrors config('epicollect.mappings.default_mapping_name') */
const DEFAULT_MAPPING_NAME = 'EC5_AUTO';

/**
 * Max map_to key length.
 * Mirrors config('epicollect.limits.project_mappings.map_key_length').
 * Verified: "1_Approx_Distance_fr" = 20 chars.
 */
const MAP_KEY_LENGTH = 20;

/**
 * Input types excluded from mapping.
 * Mirrors array_keys(config('epicollect.strings.exclude_from_mapping')).
 */
const EXCLUDE_FROM_MAPPING = new Set(['readme']);

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Map all forms.
 *
 * The counter is a single mutable object { value: 0 } shared across ALL forms
 * and ALL nesting levels — mirrors the PHP $this->inputCounter class property
 * which is incremented throughout the entire mapping generation in one pass.
 *
 * @param {Object} projectExtra
 * @returns {Object.<string, Object>}
 */
function getMappedForms(projectExtra) {
    const counter = { value: 0 };
    const map = {};
    for (const formRef of Object.keys(projectExtra.forms)) {
        map[formRef] = getMappedInputs(
            projectExtra,
            formRef,
            projectExtra.forms[formRef].inputs,
            counter
        );
    }
    return map;
}

/**
 * Map a list of input refs into their mapping entries.
 *
 * @param {Object}            projectExtra
 * @param {string}            formRef
 * @param {string[]}          inputRefs
 * @param {{ value: number }} counter  Shared mutable counter
 * @returns {Object.<string, Object>}
 */
function getMappedInputs(projectExtra, formRef, inputRefs, counter) {
    const mappedInputs = {};
    for (const inputRef of inputRefs) {
        const inputData = projectExtra.inputs[inputRef].data;
        if (EXCLUDE_FROM_MAPPING.has(inputData.type)) {
            continue;
        }
        counter.value++;
        Object.assign(mappedInputs, getMappedInput(projectExtra, formRef, inputData, counter));
    }
    return mappedInputs;
}

/**
 * Map a single input.
 *
 * For group and branch types, recurses into children with the same shared
 * counter so numbering remains globally sequential across nesting levels.
 *
 * @param {Object}            projectExtra
 * @param {string}            formRef
 * @param {Object}            inputData
 * @param {{ value: number }} counter  Shared mutable counter
 * @returns {Object.<string, Object>}
 */
function getMappedInput(projectExtra, formRef, inputData, counter) {
    const inputRef = inputData.ref;
    const entry = {
        map_to:           generateMapTo(counter.value, inputData.question),
        hide:             false,
        possible_answers: {},
        group:            {},
        branch:           {}
    };

    switch (inputData.type) {
        case 'group': {
            const groupInputRefs = projectExtra.forms[formRef].group[inputRef] || [];
            if (groupInputRefs.length > 0) {
                entry.group = getMappedInputs(projectExtra, formRef, groupInputRefs, counter);
            }
            break;
        }
        case 'branch': {
            const branchInputRefs = projectExtra.forms[formRef].branch[inputRef] || [];
            if (branchInputRefs.length > 0) {
                entry.branch = getMappedInputs(projectExtra, formRef, branchInputRefs, counter);
            }
            break;
        }
        case 'dropdown':
        case 'radio':
        case 'checkbox':
        case 'searchsingle':
        case 'searchmultiple':
            entry.possible_answers = mapPossibleAnswers(inputData);
            break;
    }

    return { [inputRef]: entry };
}

/**
 * Map possible_answers to { [answer_ref]: { map_to: answer } }.
 *
 * @param {Object} inputData
 * @returns {Object.<string, { map_to: string }>}
 */
function mapPossibleAnswers(inputData) {
    const mapped = {};
    for (const pa of inputData.possible_answers) {
        mapped[pa.answer_ref] = { map_to: pa.answer };
    }
    return mapped;
}

/**
 * Generate a map_to key.
 *
 * Mirrors PHP ProjectMappingService::generateMapTo():
 *   1. trim
 *   2. prepend "{index}_"
 *   3. collapse spaces → underscore
 *   4. strip non-alphanumeric/underscore
 *   5. truncate to MAP_KEY_LENGTH (20)
 *
 * @param {number} index     1-based counter value
 * @param {string} question
 * @returns {string}
 */
function generateMapTo(index, question) {
    let q = question.trim();
    q = index + '_' + q;
    q = q.replace(/  */g, '_');
    q = q.replace(/[^A-Za-z0-9_]/g, '');
    q = q.replace(/\s+/g, '_');
    return q.substring(0, MAP_KEY_LENGTH);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the EC5_AUTO mapping from a project_extra structure.
 *
 * @param {Object} projectExtra  Output of generateExtraStructure()
 * @returns {{ forms: Object, name: string, is_default: boolean, map_index: number }}
 */
function createEC5AUTOMapping(projectExtra) {
    return {
        forms:      getMappedForms(projectExtra),
        name:       DEFAULT_MAPPING_NAME,
        is_default: true,
        map_index:  0
    };
}

export default {
    createEC5AUTOMapping
};
