import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import projectJSONSchema from '@/schemas/project.schema.json';
import {LIMITS} from'@/config';

export const projectJsonValidate = {
    /**
     * Precision Sanitizer
     * Only targets user-facing text fields, avoiding 'regex', 'ref', and 'id'.
     */
    sanitiseAngleBrackets  (data) {
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
     * Strict 2026 Emoji Detection.
     * Uses Unicode Property Escapes to catch all pictographic symbols.
     */
    /**
     * Strict Emoji Detection compatible with more JS engines.
     * Catches characters that are intended to be rendered as emojis.
     */
    containsEmoji  (str)  {
        if (typeof str !== 'string') return false;

        // Fallback to Emoji_Presentation if Extended_Pictographic fails
        try {
            const regex = /\p{Emoji_Presentation}/u;
            return regex.test(str);
        } catch (e) {
            // Absolute fallback for very restrictive environments:
            // A manual range that covers the bulk of modern emojis
            const fallbackRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
            return fallbackRegex.test(str);
        }
    },

    isValidAgainstSchema(content) {
        // 1. Initialize Ajv
        const ajv = new Ajv({
            allErrors: true,
            verbose: true,
            // This allows AJV to recognize the $schema tag in your file
            dynamicRef: true
        });

        addFormats(ajv);
        const validator = ajv.compile(projectJSONSchema);

        // 2. Perform Validation
        const isValid =  validator(content);

        return {
            isValid,
            errors: validator.errors
        };
    },

    performDeepValidation (projectData)  {
        const data = projectData.data;
        const project = data.project;

        // 1. Cross-Field Equality
        if (data.id !== project.ref) {
            throw new Error('<strong>Validation Error</strong><br/>ID Mismatch: data.id must be identical to project.ref.');
        }

        const validateText = (text, fieldName) => {
            if (projectJsonValidate.containsEmoji(text)) {
                throw new Error(`<strong>Validation Error</strong><br/>Emoji detected in ${fieldName}.<br/>Special icons are strictly forbidden.`);
            }
        };

        // 2. Project Meta-data Checks
        validateText(project.name, 'Project Name');
        validateText(project.slug, 'Project Slug');
        validateText(project.small_description, 'Small Description');
        validateText(project.description, 'Project Description');

        let totalSearchInputs = 0;

        /**
         * Helper to validate a specific "Collection Level" (Main Form or a Branch)
         * This ensures titles are reset for branches but summed for groups.
         */

        const validateCollection = (inputs, scopeName, isTopLevel = false) => {
            let titleCount = 0;
            let localInputCount = 0;

            // Collect all refs in this specific "level" for jump/default validation
            const validRefs = inputs.map((i) => i.ref);

            if (!inputs || inputs.length === 0) {
                throw new Error(`<strong>Validation Error</strong><br/>${scopeName} has no inputs.`);
            }

            const walk = (list) => {
                list.forEach((input) => {
                    localInputCount++;
                    validateText(input.question, `Question (${input.ref})`);

                    // --- NEW: Check Answer Ref Uniqueness ---
                    if (input.possible_answers.length > 0) {
                        const answerRefs = new Set();
                        input.possible_answers.forEach((ans) => {
                            validateText(ans.answer, `Answer option in ${input.ref}`);

                            if (answerRefs.has(ans.answer_ref)) {
                                throw new Error(`<strong>Validation Error</strong><br/>Duplicate answer_ref "${ans.answer_ref}" found in input ${input.ref}.`);
                            }
                            answerRefs.add(ans.answer_ref);
                        });
                    }

                    // 1. Search limit
                    if (['searchsingle', 'searchmultiple'].includes(input.type)) {
                        totalSearchInputs++;
                    }

                    // --- 2. Titles (scoped to this collection) ---
                    // If input is in a group, it still hits this titleCount.
                    // If input is in a branch, it hits a NEW titleCount in the recursive call.
                    if (input.is_title) {
                        titleCount++;
                    }

                    // 3. Choice-based Defaults (Referential Integrity)
                    if (['radio', 'dropdown', 'searchsingle', 'searchmultiple'].includes(input.type)) {
                        if (input.default && input.default !== '') {
                            const hasAnswer = input.possible_answers.some((a) => a.answer_ref === input.default);
                            if (!hasAnswer) {
                                throw new Error(`<strong>Validation Error</strong><br/>Default value "${input.default}" in ${input.ref} does not exist in possible answers.`);
                            }
                        }
                    }

                    // 4. Jumps (Referential Integrity)
                    input.jumps.forEach((jump) => {
                        if (jump.to !== 'END' && !validRefs.includes(jump.to)) {
                            throw new Error(`<strong>Validation Error</strong><br/>Jump in ${input.ref} points to non-existent input "${jump.to}".`);
                        }
                    });

                    // --- NEW: Min/Max Validation for Integer/Decimal ---
                    if (['integer', 'decimal'].includes(input.type)) {
                        let min = input.min;
                        let max = input.max;

                        // Sanitize decimal/integer min/max: pad leading dot (e.g. .5 -> 0.5, -.5 -> -0.5)
                        const sanitizeNumericString = (val) => {
                            if (typeof val === 'string') {
                                if (val.startsWith('.')) return '0' + val;
                                if (val.startsWith('-.')) return '-0' + val.slice(1);
                            }
                            return val;
                        };

                        min = sanitizeNumericString(min);
                        max = sanitizeNumericString(max);

                        // Update input in-place for consistency
                        if (min !== undefined && min !== null) input.min = min;
                        if (max !== undefined && max !== null) input.max = max;

                        // Parse to numbers for validation
                        const minNum = (min !== undefined && min !== null && min !== '') ? Number(min) : undefined;
                        const maxNum = (max !== undefined && max !== null && max !== '') ? Number(max) : undefined;

                        // If both set, min < max
                        if (minNum !== undefined && maxNum !== undefined) {
                            if (minNum >= maxNum) {
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: min (${minNum}) must be less than max (${maxNum}).`);
                            }
                        }

                        // If only one is set, check against reasonable bounds to avoid out of range errors
                        const INT_MIN = -2147483648;
                        const INT_MAX = 2147483647;
                        const DEC_MIN = -1e12; // Reasonable limit for decimal
                        const DEC_MAX = 1e12;  // Reasonable limit for decimal

                        if (minNum !== undefined) {
                            if (input.type === 'integer' && minNum < INT_MIN) {
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: min (${minNum}) is out of range for integer.`);
                            }
                            if (input.type === 'decimal' && minNum < DEC_MIN) {
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: min (${minNum}) is out of range for decimal.`);
                            }
                        }

                        if (maxNum !== undefined) {
                            if (input.type === 'integer' && maxNum > INT_MAX) {
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: max (${maxNum}) is out of range for integer.`);
                            }
                            if (input.type === 'decimal' && maxNum > DEC_MAX) {
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: max (${maxNum}) is out of range for decimal.`);
                            }
                        }
                    }

                    // --- 6. Recursion (Hierarchy & Scoping) ---
                    if (input.type === 'branch' && input.branch?.length) {
                        // BRANCHES: New titleCount scope (starts at 0)
                        // but their inputs ADD to the total count of the form hierarchy.
                        localInputCount += validateCollection(input.branch, `Branch (${input.ref})`);
                    } else if (input.type === 'group' && input.group?.length) {
                        // GROUPS: Continue with CURRENT titleCount scope
                        walk(input.group);
                    }
                });
            };

            walk(inputs);

            if (titleCount > LIMITS.MAX_TITLES) {
                throw new Error(`<strong>Limit Exceeded</strong><br/>${scopeName} has ${titleCount} titles (Max: 3).`);
            }

            // If this is the main form, check the total accumulated count
            if (isTopLevel && localInputCount > LIMITS.MAX_QUESTIONS) {
                throw new Error(`<strong>Limit Exceeded</strong><br/>${scopeName} has ${localInputCount} total inputs (Max: 300).`);
            }

            return localInputCount;
        };

        project.forms.forEach((form) => {
            validateText(form.name, `Form Name (${form.name})`);
            // Pass true for isTopLevel to enforce the 300 limit on the whole tree
            validateCollection(form.inputs, `Form "${form.name}"`, true);
        });

        // 4. Project-wide search limit (not scoped to branches)
        if (totalSearchInputs > LIMITS.MAX_SEARCH_QUESTIONS) {
            throw new Error(`<strong>Limit Exceeded</strong><br/>Project has ${totalSearchInputs} search inputs (Max: 5).`);
        }

        return true;
    }

};
