import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import projectJSONSchema from '@/schemas/project.schema.json';
import {LIMITS} from '@/config';

export const projectJsonValidate = {
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
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
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
        const isValid = validator(content);

        return {
            isValid,
            errors: validator.errors
        };
    },

    performDeepValidation(projectData) {
        const data = projectData.data;
        const project = data.project;

        // --- Integrity: Track all form and input refs for uniqueness ---
        const formRefsSet = new Set();
        const inputRefsSet = new Set();

        // 1. Cross-Field Equality
        if (data.id !== project.ref) {
            throw new Error('<strong>Validation Error</strong><br/>ID Mismatch: data.id must be identical to project.ref.');
        }

        // --- Integrity: Each form.ref starts with project.ref + '_' and 13 hex chars, and is unique ---
        project.forms.forEach((form) => {
            if (!projectJsonValidate.isRefWith13HexSuffix(form.ref, project.ref)) {
                throw new Error(`<strong>Validation Error</strong><br/>Form ref "${form.ref}" must start with project.ref "${project.ref}" + '_' and be followed by exactly 13 lowercase hex characters.`);
            }
            if (formRefsSet.has(form.ref)) {
                throw new Error(`<strong>Validation Error</strong><br/>Duplicate form.ref "${form.ref}" found. All form refs must be unique.`);
            }
            formRefsSet.add(form.ref);
        });

        const validateText = (text, fieldName) => {
            if (projectJsonValidate.containsEmoji(text)) {
                throw new Error(`<strong>Validation Error</strong><br/>Emoji detected in ${fieldName}.<br/>Special icons are strictly forbidden.`);
            }
        };

        // 2. Project Meta-data Checks
        validateText(project.name, 'Project Name');
        validateText(project.slug, 'Project Slug');
        // --- NEW: Ensure slug length equals name length ---
        if (project.slug.length !== project.name.length) {
            throw new Error(`<strong>Validation Error</strong><br/>Project slug length (${project.slug.length}) must equal project name length (${project.name.length}).`);
        }
        validateText(project.small_description, 'Small Description');
        validateText(project.description, 'Project Description');

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
                throw new Error(`<strong>Validation Error</strong><br/>${scopeName} has no inputs.`);
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
                                throw new Error(`<strong>Validation Error</strong><br/>Input ref "${input.ref}" must start with its form.ref "${expectedPrefix}" + '_' and be followed by exactly 13 lowercase hex characters.`);
                            }
                        } else {
                            if (!projectJsonValidate.isRefWith13HexSuffix(input.ref, expectedPrefix) && !projectJsonValidate.isRefWithHexSegments(input.ref, expectedPrefix)) {
                                throw new Error(`<strong>Validation Error</strong><br/>Nested input ref "${input.ref}" must start with its parent input.ref "${expectedPrefix}" + '_' and be followed by one or more 13-char lowercase hex segments.`);
                            }
                        }
                    }
                    // --- Integrity: input.ref uniqueness project-wide ---
                    if (inputRefsSet.has(input.ref)) {
                        throw new Error(`<strong>Validation Error</strong><br/>Duplicate input.ref "${input.ref}" found. All input refs must be unique project-wide.`);
                    }
                    inputRefsSet.add(input.ref);
                    validateText(input.question, `Question (${input.ref})`);
                    // --- NEW: Check readme question length (decoded HTML entities <= 1000 chars) ---
                    if (input.type === 'readme') {
                        const decodedQuestion = projectJsonValidate.decodeHtmlEntities(input.question);
                        if (decodedQuestion.length > 1000) {
                            throw new Error(`<strong>Validation Error</strong><br/>Readme input ${input.ref}: decoded question text exceeds 1000 characters (${decodedQuestion.length}).`);
                        }
                    }
                    // Validate user-facing text fields for emojis
                    if (typeof input.default === 'string') validateText(input.default, `Default (${input.ref})`);
                    if (typeof input.regex === 'string') validateText(input.regex, `Regex (${input.ref})`);
                    // --- NEW: Check Answer Ref Uniqueness ---
                    if (input.possible_answers.length > 0) {
                        const answerRefs = new Set();
                        input.possible_answers.forEach((ans) => {
                            validateText(ans.answer, `Answer option in ${input.ref}`);
                            // --- NEW: Check answer length (max 250 chars) ---
                            if (ans.answer.length > 250) {
                                throw new Error(`<strong>Validation Error</strong><br/>Answer option "${ans.answer}" in ${input.ref} exceeds 250 characters (${ans.answer.length}).`);
                            }
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
                    if (input.is_title) {
                        titleCount++;
                    }
                    // --- NEW: Uniqueness Scope Check ---
                    if (isInBranch && input.uniqueness === 'hierarchy') {
                        throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref} is inside a branch and cannot have uniqueness "hierarchy". Allowed: "none" or "form".`);
                    }
                    // 3. Choice-based Defaults (Referential Integrity)
                    const validAnswerRefs = new Set(input.possible_answers.map((a) => a.answer_ref));
                    if (['radio', 'dropdown', 'checkbox', 'searchsingle', 'searchmultiple'].includes(input.type)) {
                        if (input.default && input.default !== '') {
                            if (!validAnswerRefs.has(input.default)) {
                                throw new Error(`<strong>Validation Error</strong><br/>Default value "${input.default}" in ${input.ref} does not exist in possible answers.`);
                            }
                        }
                    }
                    // 4. Jumps (Referential Integrity)
                    input.jumps.forEach((jump) => {
                        if (jump.answer_ref !== null && !validAnswerRefs.has(jump.answer_ref)) {
                            throw new Error(`<strong>Validation Error</strong><br/>Jump in ${input.ref} references unknown answer_ref "${jump.answer_ref}".`);
                        }
                        if (jump.to !== 'END' && !validRefs.includes(jump.to)) {
                            throw new Error(`<strong>Validation Error</strong><br/>Jump in ${input.ref} points to non-existent input "${jump.to}".`);
                        }
                        if (jump.to !== 'END') {
                            const currentIndex = inputs.findIndex((i) => i.ref === input.ref);
                            const targetIndex = inputs.findIndex((i) => i.ref === jump.to);
                            if (targetIndex <= currentIndex + 1) {
                                throw new Error(`<strong>Validation Error</strong><br/>Jump in ${input.ref} to "${jump.to}" must skip at least one question.`);
                            }
                        } else {
                            // For jumps to END, ensure it's not from the last input
                            const currentIndex = inputs.findIndex((i) => i.ref === input.ref);
                            if (currentIndex >= inputs.length - 1) {
                                throw new Error(`<strong>Validation Error</strong><br/>Jump in ${input.ref} to "END" must skip at least one question.`);
                            }
                        }
                    });
                    // Check: for multiple choice inputs, jumps cannot exceed possible_answers
                    if (input.possible_answers.length > 0 && input.jumps.length > input.possible_answers.length) {
                        throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: number of jumps (${input.jumps.length}) cannot exceed number of possible answers (${input.possible_answers.length}).`);
                    }
                    // --- NEW: Constraints for Media, Location, Readme, Branch, Group ---
                    if (['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'].includes(input.type)) {
                        if (input.verify !== false) {
                            throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref} (type: ${input.type}): verify must be false.`);
                        }
                        if (input.is_title !== false) {
                            throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref} (type: ${input.type}): is_title must be false.`);
                        }
                        if (input.default !== '' && input.default !== null) {
                            throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref} (type: ${input.type}): default must be empty.`);
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
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${input.ref}: min (${minNum}) must be less than max (${maxNum}).`);
                            }
                        }
                        const INT_MIN = -2147483648;
                        const INT_MAX = 2147483647;
                        const DEC_MIN = -1e12;
                        const DEC_MAX = 1e12;
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
                        const [lowerBound, upperBound] = input.type === 'integer'
                            ? [INT_MIN, INT_MAX]
                            : [DEC_MIN, DEC_MAX];
                        if (minNum !== undefined && (minNum < lowerBound || minNum > upperBound)) {
                            throw new Error(
                                `<strong>Validation Error</strong><br/>Input ${input.ref}: min (${minNum}) is out of range for ${input.type}.`
                            );
                        }
                        if (maxNum !== undefined && (maxNum < lowerBound || maxNum > upperBound)) {
                            throw new Error(
                                `<strong>Validation Error</strong><br/>Input ${input.ref}: max (${maxNum}) is out of range for ${input.type}.`
                            );
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
                                throw new Error(`<strong>Validation Error</strong><br/>Input ${groupInput.ref}: Jumps are forbidden within a group.`);
                            }
                        });
                        walk(input.group, input.ref);
                    }
                });
            };
            walk(inputs, parentRef);
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
            // Top-level: parentRef is form.ref
            validateCollection(form.inputs, `Form "${form.name}"`, true, false, form.ref);
        });

        // 4. Project-wide search limit (not scoped to branches)
        if (totalSearchInputs > LIMITS.MAX_SEARCH_QUESTIONS) {
            throw new Error(`<strong>Limit Exceeded</strong><br/>Project has ${totalSearchInputs} search inputs (Max: 5).`);
        }

        return true;
    }

};
