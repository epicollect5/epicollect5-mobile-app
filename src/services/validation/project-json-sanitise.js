/**
 * Project JSON Sanitization Service
 * Applies backward compatibility fixes to project definitions
 * Mirrors server-side sanitizeProjectDefinitionForExport() logic
 */

export const projectJsonSanitise = {
    /**
     * Sanitizes decimal value to ensure it has a leading zero if missing.
     * E.g., .5 becomes 0.5, -.78 becomes -0.78
     */
    sanitizeDecimalValue(value) {
        if (typeof value === 'string' && /^(-?)\.(\d+)$/.test(value)) {
            const match = value.match(/^(-?)\.(\d+)$/);
            return match[1] + '0.' + match[2];
        }
        return value;
    },

    /**
     * Recursively sanitize jumps in an input and its nested branch and group inputs.
     * Removes 'has_valid_destination' if present.
     * Sets answer_ref to null for END+ALL+no-answer_ref jumps.
     */
    sanitizeJumpsInInput(input) {
        if (input.jumps && Array.isArray(input.jumps)) {
            input.jumps.forEach((jump) => {
                // Remove 'has_valid_destination' if present
                if ('has_valid_destination' in jump) {
                    delete jump.has_valid_destination;
                }
                // Set answer_ref to null if needed
                if (
                    jump.to === 'END' &&
                    jump.when === 'ALL' &&
                    (!jump.answer_ref || jump.answer_ref === '')
                ) {
                    jump.answer_ref = null;
                }
            });
        }

        // Recursively sanitize branch inputs
        if (input.branch && Array.isArray(input.branch)) {
            input.branch.forEach((branchInput) => {
                this.sanitizeJumpsInInput(branchInput);
            });
        }

        // Recursively sanitize group inputs
        if (input.group && Array.isArray(input.group)) {
            input.group.forEach((groupInput) => {
                this.sanitizeJumpsInInput(groupInput);
            });
        }
    },

    /**
     * Recursively sanitize decimal min and max in an input and its nested branch and group inputs.
     */
    sanitizeDecimalInInput(input) {
        if (input.type === 'decimal') {
            if ('min' in input) {
                input.min = this.sanitizeDecimalValue(input.min);
            }
            if ('max' in input) {
                input.max = this.sanitizeDecimalValue(input.max);
            }
        }

        // Sanitize branch inputs
        if (input.branch && Array.isArray(input.branch)) {
            input.branch.forEach((branchInput) => {
                this.sanitizeDecimalInInput(branchInput);
            });
        }

        // Sanitize group inputs
        if (input.group && Array.isArray(input.group)) {
            input.group.forEach((groupInput) => {
                this.sanitizeDecimalInInput(groupInput);
            });
        }
    },

    /**
     * Removes jumps to 'END' from the last input in each array of inputs.
     * Recursively applies to all nested branch and group arrays.
     * This fixes legacy projects where invalid END jumps were set on last elements.
     */
    removeEndJumpsFromLastInput(inputsArray) {
        if (!Array.isArray(inputsArray) || inputsArray.length === 0) {
            return;
        }

        inputsArray.forEach((input) => {
            if (input.branch && Array.isArray(input.branch)) {
                this.removeEndJumpsFromLastInput(input.branch);
            }
            if (input.group && Array.isArray(input.group)) {
                this.removeEndJumpsFromLastInput(input.group);
            }
        });

        const lastInput = inputsArray[inputsArray.length - 1];
        if (Array.isArray(lastInput.jumps)) {
            lastInput.jumps = [];
        }
    },

    /**
     * Sanitize project definition for import (like server does on export).
     * This ensures backward compatibility with older project exports.
     *
     * Applies the following fixes:
     * - Trim newlines from descriptions
     * - Pad small_description to minimum length (15 chars)
     * - Replace < and > with _ in small_description
     * - Normalize whitespace in descriptions and form names
     * - Clear group array when input type is branch
     * - Recursively sanitize jumps in inputs
     * - Recursively sanitize decimal min/max values
     * - Remove jumps to END from last inputs in forms and branches
     */
    sanitiseProjectDefinitionForImport(projectDefinition) {
        const SMALL_DESC_MIN_LENGTH = 15;

        // Trim newlines from descriptions (description is optional per schema)
        projectDefinition.project.small_description = (projectDefinition.project.small_description || '').trim();
        projectDefinition.project.description = (projectDefinition.project.description || '').trim();

        // Pad small_description to minimum length (15 chars) with underscores
        const smallDesc = projectDefinition.project.small_description;
        if (smallDesc.length < SMALL_DESC_MIN_LENGTH) {
            const needed = SMALL_DESC_MIN_LENGTH - smallDesc.length;
            projectDefinition.project.small_description = smallDesc + '_'.repeat(needed);
        }

        // Replace < and > with _ in small_description
        projectDefinition.project.small_description = projectDefinition.project.small_description.replace(/[<>]/g, '_');

        // Normalize whitespace (replace multiple whitespace with single space)
        projectDefinition.project.small_description = projectDefinition.project.small_description.replace(/\s+/g, ' ');
        projectDefinition.project.description = projectDefinition.project.description.replace(/\s+/g, ' ');

        // Process forms
        if (projectDefinition.project.forms && Array.isArray(projectDefinition.project.forms)) {
            projectDefinition.project.forms.forEach((form) => {
                // Sanitize form name to remove invisible/whitespace characters
                if (form.name) {
                    form.name = form.name.replace(/\s+/g, ' ');
                }

                // Process form inputs
                if (form.inputs && Array.isArray(form.inputs)) {
                    form.inputs.forEach((input) => {
                        // Clear group array when input type is branch
                        if (input.type === 'branch') {
                            input.group = [];
                        }

                        // Recursively sanitize jumps in this input
                        this.sanitizeJumpsInInput(input);

                        // Recursively sanitize decimal min/max
                        this.sanitizeDecimalInInput(input);
                    });
                }
            });
        }

        // Remove END jumps from last inputs in forms
        if (projectDefinition.project.forms && Array.isArray(projectDefinition.project.forms)) {
            projectDefinition.project.forms.forEach((form) => {
                if (form.inputs && Array.isArray(form.inputs)) {
                    this.removeEndJumpsFromLastInput(form.inputs);
                }
            });
        }

        return projectDefinition;
    }
};
