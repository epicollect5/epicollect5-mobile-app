import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import * as ajvI18n from 'ajv-i18n';
import projectJSONSchema from '@/schemas/project.schema.json';
import {LIMITS, PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {utilsService} from '@/services/utilities/utils-service';
import {escapeHtml} from '@/services/errors-service';

export const projectJsonValidate = {
    getValidationErrors(language = PARAMETERS.DEFAULT_LANGUAGE) {
        const validLanguages = [PARAMETERS.DEFAULT_LANGUAGE, ...PARAMETERS.SUPPORTED_LANGUAGES];
        const currentLanguage = validLanguages.includes(language) ? language : PARAMETERS.DEFAULT_LANGUAGE;
        return STRINGS[currentLanguage]?.validation_errors || STRINGS[PARAMETERS.DEFAULT_LANGUAGE].validation_errors;
    },

    formatValidationError(language, key, params = {}) {
        const fallbackErrors = STRINGS[PARAMETERS.DEFAULT_LANGUAGE].validation_errors;
        const errors = projectJsonValidate.getValidationErrors(language);
        const template = errors[key] || fallbackErrors[key] || key;

        return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
            if (Object.prototype.hasOwnProperty.call(params, name)) {
                return escapeHtml(params[name]);
            }

            return match;
        });
    },

    getValidationFieldLabel(language, key, params = {}) {
        return projectJsonValidate.formatValidationError(language, key, params);
    },

    /**
     * Precision Sanitizer
     * Only targets user-facing text fields, avoiding 'regex', 'ref', and 'id'.
     */
    sanitiseAngleBrackets(data) {
        if (Array.isArray(data)) {
            return data.map((item) => projectJsonValidate.sanitiseAngleBrackets(item));
        }

        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                // SKIP sanitization for logic-heavy keys
                const skipKeys = ['regex', 'ref', 'id', 'type', 'pattern', '$schema'];

                if (skipKeys.includes(key)) {
                    result[key] = value;
                } else if (typeof value === 'string') {
                    // Sanitize only strings in allowed keys
                    result[key] = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                } else {
                    // Recurse for nested objects/arrays
                    result[key] = projectJsonValidate.sanitiseAngleBrackets(value);
                }
            }
            return result;
        }
        return data;
    },

    /**
     * Decodes basic HTML entities to plain text.
     * Handles &lt;, &gt;, &amp;, &quot;, &#39; (and numeric &#39;).
     */
    decodeHtmlEntities(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, '\'')
            .replace(/&apos;/g, '\''); // Sometimes used
    },

    /**
     * Comprehensive Emoji Detection.
     * Covers single-codepoint emojis, modifiers, flags, keycaps, and ZWJ sequences.
     */
    containsEmoji(str) {
        if (typeof str !== 'string') return false;

        // eslint-disable-next-line no-misleading-character-class
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        return emojiRegex.test(str);
    },

    /**
     * Checks if str starts with prefix + '_' and the rest is exactly 13 lowercase hex chars.
     */
    isRefWith13HexSuffix(str, prefix) {
        if (typeof str !== 'string' || typeof prefix !== 'string') return false;
        if (!str.startsWith(prefix + '_')) return false;
        const suffix = str.slice(prefix.length + 1);
        return /^[a-f0-9]{13}$/.test(suffix);
    },

    /**
     * Checks if str starts with prefix + '_' and the rest is one or more '_'-separated 13-hex segments.
     */
    isRefWithHexSegments(str, prefix) {
        if (typeof str !== 'string' || typeof prefix !== 'string') return false;
        if (!str.startsWith(prefix + '_')) return false;
        const suffix = str.slice(prefix.length + 1);
        return /^([a-f0-9]{13})(_[a-f0-9]{13})*$/.test(suffix);
    },

    isValidAgainstSchema(content, language = 'en') {
        // 1. Initialize Ajv
        const ajv = new Ajv({
            allErrors: true,
            verbose: true,
            dynamicRef: true,
            allowUnionTypes: true
        });

        addFormats(ajv);
        const validator = ajv.compile(projectJSONSchema);

        // 2. Perform Validation
        const isValid = validator(content);

        // If invalid, attempt to localize AJV messages in-place using ajv-i18n
        // Only translate for non-English locales to avoid changing existing EN messages
        if (!isValid && validator.errors && typeof language === 'string' && language !== 'en') {
            try {
                const translator = ajvI18n[language];
                if (typeof translator === 'function') {
                    translator(validator.errors);
                }
            } catch (e) {
                // Fail silently: keep original messages if translation fails
                // eslint-disable-next-line no-console
                console.error('ajv-i18n translation error', e);
            }
        }

        return {
            isValid,
            errors: validator.errors
        };
    },

    isValidProjectMapping(projectMapping, language = 'en') {
        const ajv = new Ajv({
            allErrors: true,
            verbose: true,
            dynamicRef: true,
            allowUnionTypes: true
        });

        addFormats(ajv);

        const projectMappingSchema = {
            type: 'array',
            items: {
                $ref: '#/$defs/project_mapping'
            },
            $defs: projectJSONSchema.$defs
        };

        const validator = ajv.compile(projectMappingSchema);
        const isValid = validator(projectMapping);

        if (!isValid && validator.errors && typeof language === 'string' && language !== 'en') {
            try {
                const translator = ajvI18n[language];
                if (typeof translator === 'function') {
                    translator(validator.errors);
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('ajv-i18n translation error', e);
            }
        }

        return {
            isValid,
            errors: validator.errors
        };
    },

    /**
     * Pre-validates project structure before full validation.
     * Ensures: data/id/project keys present, id === project.ref,
     * all required project metadata keys present,
     * at least 1 form with at least 1 input.
     * Throws descriptive error if structure is invalid.
     * Uses device language for localized error messages.
     */
    preValidateProjectStructure(content, language = PARAMETERS.DEFAULT_LANGUAGE) {
        // Ensure language is valid, fallback to English if not
        const errors = projectJsonValidate.getValidationErrors(language);

        // Check top-level envelope
        if (!content || typeof content !== 'object') {
            throw new Error(errors.invalid_data_object);
        }
        if (!content.data) {
            throw new Error(errors.missing_data_key);
        }

        const data = content.data;
        if (typeof data !== 'object') {
            throw new Error(errors.data_not_object);
        }

        // Check required top-level keys in data
        if (!data.id) {
            throw new Error(errors.missing_data_id);
        }
        if (!data.type) {
            throw new Error(errors.missing_data_type);
        }
        if (!data.project) {
            throw new Error(errors.missing_data_project);
        }

        const project = data.project;
        if (typeof project !== 'object') {
            throw new Error(errors.project_not_object);
        }

        // Check id === project.ref
        if (data.id !== project.ref) {
            throw new Error(errors.id_mismatch);
        }

        // Check all required project metadata keys
        const requiredProjectKeys = ['ref', 'name', 'slug', 'forms', 'category', 'small_description', 'visibility', 'access', 'status'];
        const keyErrorMap = {
            ref: errors.missing_project_key_ref,
            name: errors.missing_project_key_name,
            slug: errors.missing_project_key_slug,
            forms: errors.missing_project_key_forms,
            category: errors.missing_project_key_category,
            small_description: errors.missing_project_key_small_description,
            visibility: errors.missing_project_key_visibility,
            access: errors.missing_project_key_access,
            status: errors.missing_project_key_status
        };

        for (const key of requiredProjectKeys) {
            if (!(key in project)) {
                throw new Error(keyErrorMap[key]);
            }
        }

        // Check forms array
        if (!Array.isArray(project.forms)) {
            throw new Error(errors.forms_not_array);
        }
        if (project.forms.length === 0) {
            throw new Error(errors.no_forms);
        }

        // Check at least 1 form has at least 1 input
        let hasInputs = false;
        for (const form of project.forms) {
            if (Array.isArray(form.inputs) && form.inputs.length > 0) {
                hasInputs = true;
                break;
            }
        }
        if (!hasInputs) {
            throw new Error(errors.no_form_inputs);
        }

        return true;
    },


    performDeepValidation(projectData, language = PARAMETERS.DEFAULT_LANGUAGE) {
        const data = projectData.data;
        const project = data.project;

        // --- Integrity: Track all form and input refs for uniqueness ---
        const formRefsSet = new Set();
        const inputRefsSet = new Set();

        // 1. Cross-Field Equality
        if (data.id !== project.ref) {
            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_id_mismatch'));
        }

        // 1a. Defense-in-depth: enforce max forms (schema also enforces this)
        if (project.forms.length > LIMITS.MAX_FORMS) {
            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_form_limit_exceeded', {
                formsCount: project.forms.length,
                maxForms: LIMITS.MAX_FORMS
            }));
        }

        // --- Integrity: Each form.ref starts with project.ref + '_' and 13 hex chars, and is unique ---
        project.forms.forEach((form) => {
            if (!projectJsonValidate.isRefWith13HexSuffix(form.ref, project.ref)) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_form_ref_invalid', {
                    formRef: form.ref,
                    projectRef: project.ref
                }));
            }
            if (formRefsSet.has(form.ref)) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_form_ref_duplicate', {
                    formRef: form.ref
                }));
            }
            formRefsSet.add(form.ref);
        });

        const validateText = (text, fieldName) => {
            if (projectJsonValidate.containsEmoji(text)) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_emoji_detected', {
                    fieldName
                }));
            }
        };

        // 2. Project Meta-data Checks
        validateText(project.name, projectJsonValidate.getValidationFieldLabel(language, 'field_project_name'));
        validateText(project.slug, projectJsonValidate.getValidationFieldLabel(language, 'field_project_slug'));
        const expectedProjectSlug = utilsService.laravelSlug(project.name);
        if (project.slug !== expectedProjectSlug) {
            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_project_slug_mismatch', {
                actualSlug: project.slug,
                projectName: project.name,
                expectedSlug: expectedProjectSlug
            }));
        }
        validateText(project.small_description, projectJsonValidate.getValidationFieldLabel(language, 'field_small_description'));
        validateText(project.description, projectJsonValidate.getValidationFieldLabel(language, 'field_project_description'));

        let totalSearchInputs = 0;

        /**
         * Helper to validate a specific "Collection Level" (Main Form or a Branch)
         * This ensures titles are reset for branches but summed for groups.
         */

        /**
         * Validate a collection of inputs (main form, branch, or group)
         * parentRef: the ref that all direct children must be prefixed with (form.ref for top-level, parent input.ref for nested)
         */
        const validateCollection = (inputs, scopeName, isTopLevel = false, isInBranch = false, parentRef = null) => {
            let titleCount = 0;
            let localInputCount = 0;
            // Collect all refs in this specific "level" for jump/default validation
            const validRefs = inputs.map((i) => i.ref);
            if (!inputs || inputs.length === 0) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_scope_no_inputs', {
                    scopeName
                }));
            }
            const walk = (list, parentRefForLevel) => {
                list.forEach((input) => {
                    localInputCount++;
                    // --- Integrity: input.ref must start with parentRef + '_' and 13 hex chars (or more for nested) ---
                    if (parentRefForLevel) {
                        // For top-level, must be form.ref + _ + 13hex; for nested, must be parent input.ref + _ + 13hex (possibly more segments)
                        const expectedPrefix = parentRefForLevel;
                        // For top-level, only one segment; for nested, allow multiple segments
                        if (isTopLevel) {
                            if (!projectJsonValidate.isRefWith13HexSuffix(input.ref, expectedPrefix)) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_input_ref_invalid', {
                                    inputRef: input.ref,
                                    expectedPrefix
                                }));
                            }
                        } else {
                            if (!projectJsonValidate.isRefWith13HexSuffix(input.ref, expectedPrefix) && !projectJsonValidate.isRefWithHexSegments(input.ref, expectedPrefix)) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_nested_input_ref_invalid', {
                                    inputRef: input.ref,
                                    expectedPrefix
                                }));
                            }
                        }
                    }
                    // --- Integrity: input.ref uniqueness project-wide ---
                    if (inputRefsSet.has(input.ref)) {
                        throw new Error(projectJsonValidate.formatValidationError(language, 'deep_input_ref_duplicate', {
                            inputRef: input.ref
                        }));
                    }
                    inputRefsSet.add(input.ref);
                    validateText(input.question, projectJsonValidate.getValidationFieldLabel(language, 'field_question', {
                        ref: input.ref
                    }));
                    // --- NEW: Check readme question length (decoded HTML entities <= 1000 chars) ---
                    if (input.type === 'readme') {
                        const decodedQuestion = projectJsonValidate.decodeHtmlEntities(input.question);
                        if (decodedQuestion.length > 1000) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_readme_question_too_long', {
                                inputRef: input.ref,
                                length: decodedQuestion.length
                            }));
                        }
                    }
                    // Validate user-facing text fields for emojis
                    if (typeof input.default === 'string') {
                        validateText(input.default, projectJsonValidate.getValidationFieldLabel(language, 'field_default', {
                            ref: input.ref
                        }));
                    }
                    if (typeof input.regex === 'string') {
                        validateText(input.regex, projectJsonValidate.getValidationFieldLabel(language, 'field_regex', {
                            ref: input.ref
                        }));
                    }
                    // --- NEW: Check Answer Ref Uniqueness ---
                    if (input.possible_answers.length > 0) {
                        const answerRefs = new Set();
                        input.possible_answers.forEach((ans) => {
                            validateText(ans.answer, projectJsonValidate.getValidationFieldLabel(language, 'field_answer_option', {
                                ref: input.ref
                            }));
                            // --- NEW: Check answer length (max 250 chars) ---
                            if (ans.answer.length > 250) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_answer_too_long', {
                                    answer: ans.answer,
                                    inputRef: input.ref,
                                    length: ans.answer.length
                                }));
                            }
                            if (answerRefs.has(ans.answer_ref)) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_answer_ref_duplicate', {
                                    answerRef: ans.answer_ref,
                                    inputRef: input.ref
                                }));
                            }
                            answerRefs.add(ans.answer_ref);
                        });
                    }
                    // 1. Search limit
                    if (['searchsingle', 'searchmultiple'].includes(input.type)) {
                        totalSearchInputs++;
                    }
                    // --- 2. Titles (scoped to this collection) ---
                    if (input.is_title) {
                        titleCount++;
                    }
                    // --- NEW: Uniqueness Scope Check ---
                    if (isInBranch && input.uniqueness === 'hierarchy') {
                        throw new Error(projectJsonValidate.formatValidationError(language, 'deep_uniqueness_hierarchy_in_branch', {
                            inputRef: input.ref
                        }));
                    }
                    // 3. Choice-based Defaults (Referential Integrity)
                    const validAnswerRefs = new Set(input.possible_answers.map((a) => a.answer_ref));
                    if (['radio', 'dropdown', 'checkbox', 'searchsingle', 'searchmultiple'].includes(input.type)) {
                        if (input.default && input.default !== '') {
                            if (!validAnswerRefs.has(input.default)) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_default_missing_possible_answer', {
                                    defaultValue: input.default,
                                    inputRef: input.ref
                                }));
                            }
                        }
                    }
                    // 4. Jumps (Referential Integrity)
                    input.jumps.forEach((jump) => {
                        if (jump.answer_ref !== null && !validAnswerRefs.has(jump.answer_ref)) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_jump_unknown_answer_ref', {
                                inputRef: input.ref,
                                answerRef: jump.answer_ref
                            }));
                        }
                        if (jump.to !== 'END' && !validRefs.includes(jump.to)) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_jump_non_existent_input', {
                                inputRef: input.ref,
                                targetRef: jump.to
                            }));
                        }
                        if (jump.to !== 'END') {
                            const currentIndex = inputs.findIndex((i) => i.ref === input.ref);
                            const targetIndex = inputs.findIndex((i) => i.ref === jump.to);
                            if (targetIndex <= currentIndex + 1) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_jump_must_skip_question', {
                                    inputRef: input.ref,
                                    targetRef: jump.to
                                }));
                            }
                        } else {
                            // For jumps to END, ensure it's not from the last input
                            const currentIndex = inputs.findIndex((i) => i.ref === input.ref);
                            if (currentIndex >= inputs.length - 1) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_jump_end_must_skip_question', {
                                    inputRef: input.ref
                                }));
                            }
                        }
                    });
                    // Check: for multiple choice inputs, jumps cannot exceed possible_answers
                    if (input.possible_answers.length > 0 && input.jumps.length > input.possible_answers.length) {
                        throw new Error(projectJsonValidate.formatValidationError(language, 'deep_jumps_exceed_answers', {
                            inputRef: input.ref,
                            jumpsCount: input.jumps.length,
                            answersCount: input.possible_answers.length
                        }));
                    }
                    // --- NEW: Constraints for Media, Location, Readme, Branch, Group ---
                    if (['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'].includes(input.type)) {
                        if (input.verify !== false) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_type_verify_false', {
                                inputRef: input.ref,
                                inputType: input.type
                            }));
                        }
                        if (input.is_title !== false) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_type_is_title_false', {
                                inputRef: input.ref,
                                inputType: input.type
                            }));
                        }
                        if (input.default !== '' && input.default !== null) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_type_default_empty', {
                                inputRef: input.ref,
                                inputType: input.type
                            }));
                        }
                    }
                    // --- NEW: Min/Max Validation for Integer/Decimal ---
                    if (['integer', 'decimal'].includes(input.type)) {
                        let min = input.min;
                        let max = input.max;
                        const sanitizeNumericString = (val) => {
                            if (typeof val === 'string') {
                                if (val.startsWith('.')) return '0' + val;
                                if (val.startsWith('-.')) return '-0' + val.slice(1);
                            }
                            return val;
                        };
                        min = sanitizeNumericString(min);
                        max = sanitizeNumericString(max);
                        if (min !== undefined && min !== null) input.min = min;
                        if (max !== undefined && max !== null) input.max = max;
                        const minNum = (min !== undefined && min !== null && min !== '') ? Number(min) : undefined;
                        const maxNum = (max !== undefined && max !== null && max !== '') ? Number(max) : undefined;
                        if (minNum !== undefined && maxNum !== undefined) {
                            if (minNum >= maxNum) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_min_less_than_max', {
                                    inputRef: input.ref,
                                    min: minNum,
                                    max: maxNum
                                }));
                            }
                        }
                        const INT_MIN = -2147483648;
                        const INT_MAX = 2147483647;
                        const DEC_MIN = -1e12;
                        const DEC_MAX = 1e12;
                        const [lowerBound, upperBound] = input.type === 'integer'
                            ? [INT_MIN, INT_MAX]
                            : [DEC_MIN, DEC_MAX];
                        if (minNum !== undefined && (minNum < lowerBound || minNum > upperBound)) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_min_out_of_range', {
                                inputRef: input.ref,
                                min: minNum,
                                inputType: input.type
                            }));
                        }
                        if (maxNum !== undefined && (maxNum < lowerBound || maxNum > upperBound)) {
                            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_max_out_of_range', {
                                inputRef: input.ref,
                                max: maxNum,
                                inputType: input.type
                            }));
                        }
                    }
                    // --- 6. Recursion (Hierarchy & Scoping) ---
                    if (input.type === 'branch' && input.branch?.length) {
                        // BRANCHES: New titleCount scope (starts at 0)
                        // but their inputs ADD to the total count of the form hierarchy.
                        localInputCount += validateCollection(input.branch, `Branch (${input.ref})`, false, true, input.ref);
                    } else if (input.type === 'group' && input.group?.length) {
                        // GROUPS: Continue with CURRENT titleCount scope
                        // JUMPS are forbidden within groups (already in schema, but adding to deep validation for safety)
                        input.group.forEach((groupInput) => {
                            if (groupInput.jumps && groupInput.jumps.length > 0) {
                                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_group_jumps_forbidden', {
                                    inputRef: groupInput.ref
                                }));
                            }
                        });
                        walk(input.group, input.ref);
                    }
                });
            };
            walk(inputs, parentRef);
            if (titleCount > LIMITS.MAX_TITLES) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_title_limit_exceeded', {
                    scopeName,
                    titleCount,
                    maxTitles: LIMITS.MAX_TITLES
                }));
            }
            // If this is the main form, check the total accumulated count
            if (isTopLevel && localInputCount > LIMITS.MAX_QUESTIONS) {
                throw new Error(projectJsonValidate.formatValidationError(language, 'deep_input_limit_exceeded', {
                    scopeName,
                    inputCount: localInputCount,
                    maxQuestions: LIMITS.MAX_QUESTIONS
                }));
            }
            return localInputCount;
        };

        project.forms.forEach((form) => {
            validateText(form.name, projectJsonValidate.getValidationFieldLabel(language, 'field_form_name', {
                name: form.name
            }));
            // Pass true for isTopLevel to enforce the 300 limit on the whole tree
            // Top-level: parentRef is form.ref
            validateCollection(form.inputs, `Form "${form.name}"`, true, false, form.ref);
        });

        // 4. Project-wide search limit (not scoped to branches)
        if (totalSearchInputs > LIMITS.MAX_SEARCH_QUESTIONS) {
            throw new Error(projectJsonValidate.formatValidationError(language, 'deep_search_limit_exceeded', {
                searchCount: totalSearchInputs,
                maxSearchQuestions: LIMITS.MAX_SEARCH_QUESTIONS
            }));
        }

        return true;
    }

};
