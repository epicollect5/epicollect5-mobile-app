/**
 * projectExtraService.js
 *
 * Ionic/Vue (plain JavaScript) port of the PHP ProjectExtraService.
 *
 * Consumes a raw project-definition object (as returned by the Epicollect5
 * API) and produces the `project_extra` structure used by the rest of the app.
 *
 * Supported input shapes:
 *   { data: { id, type, project } }   ← full API envelope (JSON schema root)
 *   { project: { ... } }              ← unwrapped project definition
 *
 * Usage:
 *   import { generateExtraStructure } from '@/services/projectExtraService'
 *   const projectExtra = generateExtraStructure(apiResponse)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Input types that carry a list of selectable answers.
 *
 * The PHP config is a key=value map where keys equal values:
 *   'multiple_choice_question_types' => ['radio'=>'radio', 'checkbox'=>'checkbox', ...]
 * The PHP service calls array_keys() on it, so only the keys matter.
 * This Set contains exactly those same strings.
 *
 * Per JSON schema:
 *   - radio, checkbox, dropdown    → possible_answers min 1, max 300
 *   - searchsingle, searchmultiple → possible_answers min 1, max 1000
 */
const MULTIPLE_CHOICE_QUESTION_TYPES = new Set([
    'radio',
    'checkbox',
    'dropdown',
    'searchsingle',
    'searchmultiple'
]);

const INPUT_TYPE_LOCATION = 'location';
const INPUT_TYPE_GROUP    = 'group';
const INPUT_TYPE_BRANCH   = 'branch';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the project_extra structure from a project definition.
 *
 * @param {Object} projectDefinition
 *   Either the full API envelope `{ data: { id, type, project } }`
 *   or the unwrapped shape `{ project: { ... } }`.
 *
 * @returns {{
 *   forms:   Object.<string, FormExtra>,
 *   inputs:  Object.<string, { data: Input }>,
 *   project: ProjectExtraProject
 * }}
 */
export function generateExtraStructure(projectDefinition) {
    // Normalise both envelope shapes
    const root = 'data' in projectDefinition
        ? projectDefinition.data
        : projectDefinition;

    const project = root.project;
    const forms   = project.forms;

    /** @type {string[]} */
    const formRefs = [];

    /** @type {Object.<string, { data: Input }>} */
    const inputsExtra = {};

    const formsExtra = buildFormsExtra(forms, formRefs, inputsExtra);

    return {
        forms:   formsExtra,
        inputs:  inputsExtra,
        project: buildProjectExtra(project, formRefs)
    };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * @param {Form[]}                          forms
 * @param {string[]}                        formRefs      mutated in place
 * @param {Object.<string, { data: Input }>} inputsExtra  mutated in place
 * @returns {Object.<string, FormExtra>}
 */
function buildFormsExtra(forms, formRefs, inputsExtra) {
    /** @type {Object.<string, FormExtra>} */
    const formsExtra = {};

    forms.forEach((form, index) => {
        formRefs.push(form.ref);

        let hasLocation = false;

        /** @type {LocationInputEntry[]} */
        const locationInputs = [];

        /** @type {Object.<string, MultipleChoiceInputEntry>} */
        const multipleChoiceInputs = {};
        /** @type {string[]} */
        const multipleChoiceInputRefsInOrder = [];

        /**
         * Branch MC bucket — keyed by the parent branch input ref.
         * Each entry: { order: string[], [childRef]: MultipleChoiceInputEntry, ... }
         * Matches the expected structure:
         *   branch: {
         *     [branchRef]: {
         *       order: [...],
         *       [childRef]: { question, possible_answers },
         *       ...
         *     }
         *   }
         * @type {Object.<string, Object>}
         */
        const multipleChoiceBranchInputs = {};

        // Top-level input refs only — branch/group children are excluded
        /** @type {string[]} */
        const inputRefs = [];

        /** @type {Object.<string, string[]>} */
        const branches = {};

        /** @type {Object.<string, string[]>} */
        const groups = {};

        for (const input of form.inputs) {
            inputsExtra[input.ref] = { data: flattenInput(input) };
            inputRefs.push(input.ref);

            // ── location ──────────────────────────────────────────────────────────
            if (input.type === INPUT_TYPE_LOCATION) {
                hasLocation = true;
                locationInputs.push({
                    question:  input.question,
                    input_ref: input.ref,
                    branch_ref: null
                });
            }

            // ── multiple choice (form level) ──────────────────────────────────────
            if (MULTIPLE_CHOICE_QUESTION_TYPES.has(input.type)) {
                multipleChoiceInputRefsInOrder.push(input.ref);
                multipleChoiceInputs[input.ref] = {
                    question:         input.question,
                    possible_answers: convertToHashMap(input.possible_answers)
                };
            }

            // ── group ─────────────────────────────────────────────────────────────
            if (input.type === INPUT_TYPE_GROUP) {
                /** @type {string[]} */
                const groupInputRefs = [];

                for (const groupInput of input.group) {
                    groupInputRefs.push(groupInput.ref);
                    inputsExtra[groupInput.ref] = { data: flattenInput(groupInput) };

                    if (groupInput.type === INPUT_TYPE_LOCATION) {
                        hasLocation = true;
                        locationInputs.push({
                            question:  groupInput.question,
                            input_ref: groupInput.ref,
                            branch_ref: null
                        });
                    }

                    // MC inputs inside a top-level group go into the *form* bucket.
                    // (Verified against meta.project_extra ground truth.)
                    if (MULTIPLE_CHOICE_QUESTION_TYPES.has(groupInput.type)) {
                        multipleChoiceInputRefsInOrder.push(groupInput.ref);
                        multipleChoiceInputs[groupInput.ref] = {
                            question:         groupInput.question,
                            possible_answers: convertToHashMap(groupInput.possible_answers)
                        };
                    }
                }

                groups[input.ref] = groupInputRefs;
            }

            // ── branch ────────────────────────────────────────────────────────────
            if (input.type === INPUT_TYPE_BRANCH) {
                /** @type {string[]} */
                const branchInputRefs = [];

                // Accumulate MC entries for this branch parent under its own ref key
                /** @type {string[]} */
                const thisBranchMcOrder = [];
                /** @type {Object.<string, MultipleChoiceInputEntry>} */
                const thisBranchMcEntries = {};

                for (const branchInput of input.branch) {
                    branchInputRefs.push(branchInput.ref);
                    inputsExtra[branchInput.ref] = { data: flattenInput(branchInput) };

                    if (branchInput.type === INPUT_TYPE_LOCATION) {
                        hasLocation = true;
                        locationInputs.push({
                            question:  branchInput.question,
                            // PHP uses the *parent* branch input's ref here, not the location's own ref
                            input_ref:  input.ref,
                            branch_ref: branchInput.ref
                        });
                    }

                    if (MULTIPLE_CHOICE_QUESTION_TYPES.has(branchInput.type)) {
                        thisBranchMcOrder.push(branchInput.ref);
                        thisBranchMcEntries[branchInput.ref] = {
                            question:         branchInput.question,
                            possible_answers: convertToHashMap(branchInput.possible_answers)
                        };
                    }

                    // ── group inside branch ──────────────────────────────────────────
                    if (branchInput.type === INPUT_TYPE_GROUP) {
                        /** @type {string[]} */
                        const branchGroupInputRefs = [];

                        for (const branchGroupInput of branchInput.group) {
                            branchGroupInputRefs.push(branchGroupInput.ref);
                            inputsExtra[branchGroupInput.ref] = { data: flattenInput(branchGroupInput) };

                            if (branchGroupInput.type === INPUT_TYPE_LOCATION) {
                                hasLocation = true;
                                locationInputs.push({
                                    question:  branchGroupInput.question,
                                    input_ref:  branchGroupInput.ref,
                                    branch_ref: branchInput.ref
                                });
                            }

                            if (MULTIPLE_CHOICE_QUESTION_TYPES.has(branchGroupInput.type)) {
                                thisBranchMcOrder.push(branchGroupInput.ref);
                                thisBranchMcEntries[branchGroupInput.ref] = {
                                    question:         branchGroupInput.question,
                                    possible_answers: convertToHashMap(branchGroupInput.possible_answers)
                                };
                            }
                        }

                        groups[branchInput.ref] = branchGroupInputRefs;
                    }
                }

                branches[input.ref] = branchInputRefs;

                // Only add an entry to the branch MC bucket if there are MC inputs
                if (thisBranchMcOrder.length > 0) {
                    multipleChoiceBranchInputs[input.ref] = {
                        order: thisBranchMcOrder,
                        ...thisBranchMcEntries
                    };
                }
            }
        }

        formsExtra[formRefs[index]] = {
            group: groups,
            lists: {
                location_inputs: locationInputs,
                multiple_choice_inputs: {
                    form: {
                        order: multipleChoiceInputRefsInOrder,
                        ...multipleChoiceInputs
                    },
                    // Branch MC entries are keyed by parent branch ref, each with its own
                    // order array + child entries. Empty object when no branch MC inputs exist.
                    branch: multipleChoiceBranchInputs
                }
            },
            branch: branches,
            inputs: inputRefs,
            details: {
                ref:          formRefs[index],
                name:         form.name,
                slug:         form.slug,
                type:         'hierarchy',
                has_location: hasLocation
            }
        };
    });

    return formsExtra;
}

/**
 * @param {Project}  project
 * @param {string[]} formRefs
 * @returns {ProjectExtraProject}
 */
function buildProjectExtra(project, formRefs) {
    return {
        forms: formRefs,
        details: {
            ref:               project.ref,
            name:              project.name,
            slug:              project.slug,
            access:            project.access,
            status:            project.status,
            logo_url:          project.logo_url,
            visibility:        project.visibility,
            small_description: project.small_description,
            description:       project.description,
            category:          project.category
        },
        entries_limits: project.entries_limits
    };
}

/**
 * Convert a possible_answers array into a ref→label hash-map.
 *
 * @param {{ answer: string, answer_ref: string }[]} possibleAnswers
 * @returns {Object.<string, string>}
 */
function convertToHashMap(possibleAnswers) {
    const map = {};
    for (const answer of possibleAnswers) {
        map[answer.answer_ref] = answer.answer;
    }
    return map;
}

/**
 * Return a copy of the input with group and branch children emptied out.
 *
 * When inputs are stored in inputsExtra the nested children are not included —
 * group and branch arrays are always stored as []. This matches the expected
 * project_extra.inputs structure (see document 6 in the project context).
 *
 * @param {Input} input
 * @returns {Input}
 */
function flattenInput(input) {
    return { ...input, group: [], branch: [] };
}

// ---------------------------------------------------------------------------
// JSDoc type definitions (for IDE support — not enforced at runtime)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PossibleAnswer
 * @property {string} answer      Display label (max 250 chars, no < >).
 * @property {string} answer_ref  13-char lowercase hex identifier.
 */

/**
 * @typedef {Object} Input
 * @property {string}           ref
 * @property {string}           type          One of the 20 types defined in the JSON schema.
 * @property {string}           question
 * @property {boolean}          is_title
 * @property {boolean}          is_required
 * @property {string}           uniqueness    'none' | 'form' | 'hierarchy'
 * @property {boolean}          verify
 * @property {string|null}      default
 * @property {string|null}      regex
 * @property {string|number|null} max
 * @property {string|number|null} min
 * @property {string|null}      datetime_format
 * @property {boolean}          set_to_current_datetime
 * @property {PossibleAnswer[]} possible_answers
 * @property {Object[]}         jumps
 * @property {Input[]}          branch        Non-empty only when type === 'branch'.
 * @property {Input[]}          group         Non-empty only when type === 'group'.
 */

/**
 * @typedef {Object} Form
 * @property {string}  ref
 * @property {string}  name
 * @property {string}  slug
 * @property {string}  type   Always 'hierarchy'.
 * @property {Input[]} inputs
 */

/**
 * @typedef {Object} Project
 * @property {string}  ref
 * @property {string}  name
 * @property {string}  slug
 * @property {string}  access      'public' | 'private'
 * @property {string}  status      'active' | 'locked' | 'trashed'
 * @property {string}  logo_url
 * @property {string}  visibility  'hidden' | 'listed'
 * @property {string}  small_description
 * @property {string}  description
 * @property {string}  category    'general' | 'social' | 'art' | 'humanities' | 'biology' | 'economics' | 'science'
 * @property {Form[]}  forms
 * @property {Array|Object} entries_limits
 */

/**
 * @typedef {Object} LocationInputEntry
 * @property {string}      question
 * @property {string}      input_ref
 * @property {string|null} branch_ref
 */

/**
 * @typedef {Object} MultipleChoiceInputEntry
 * @property {string}              question
 * @property {Object.<string, string>} possible_answers  answer_ref → label map
 */

/**
 * @typedef {Object} FormExtraDetails
 * @property {string}  ref
 * @property {string}  name
 * @property {string}  slug
 * @property {string}  type         Always 'hierarchy'.
 * @property {boolean} has_location
 */

/**
 * @typedef {Object} FormExtra
 * @property {Object.<string, string[]>}           group
 * @property {{ location_inputs: LocationInputEntry[], multiple_choice_inputs: { form: Object, branch: Object } }} lists
 * @property {Object.<string, string[]>}           branch
 * @property {string[]}                            inputs
 * @property {FormExtraDetails}                    details
 */

/**
 * @typedef {Object} ProjectExtraProject
 * @property {string[]} forms
 * @property {{ ref: string, name: string, slug: string, access: string, status: string, logo_url: string, visibility: string, small_description: string, description: string, category: string }} details
 * @property {Array|Object} entries_limits
 */

export default { generateExtraStructure };
