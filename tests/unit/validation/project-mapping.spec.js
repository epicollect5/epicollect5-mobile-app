import {describe, it, expect} from 'vitest';
import {projectJsonValidate} from '@/services/validation/project-json-validate';
import projectMappingService from '@/services/project-mapping-service';

const PROJECT_REF = 'a'.repeat(32);
const FORM_REF = `${PROJECT_REF}_${'b'.repeat(13)}`;
const INPUT_REF = `${FORM_REF}_${'c'.repeat(13)}`;
const ANSWER_REF = 'd'.repeat(13);

const createValidProjectMapping = () => ([
    {
        name: 'EC5_AUTO',
        map_index: 0,
        is_default: true,
        forms: {
            [FORM_REF]: {
                [INPUT_REF]: {
                    hide: false,
                    group: [],
                    branch: [],
                    map_to: 'field_1',
                    possible_answers: {
                        [ANSWER_REF]: {
                            map_to: 'OptionA'
                        }
                    }
                }
            }
        }
    }
]);

const createProjectExtra = () => ({
    forms: {
        [FORM_REF]: {
            inputs: [INPUT_REF],
            group: {},
            branch: {}
        }
    },
    inputs: {
        [INPUT_REF]: {
            data: {
                ref: INPUT_REF,
                type: 'text',
                question: 'Sample question'
            }
        }
    }
});

describe('project_mapping validation', () => {
    it('accepts a valid project mapping', () => {
        const result = projectJsonValidate.isValidProjectMapping(createValidProjectMapping());

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
    });

    it('accepts imported mappings with custom name, index and default flag', () => {
        const mapping = createValidProjectMapping();
        mapping[0].name = 'Test';
        mapping[0].map_index = 1;
        mapping[0].is_default = false;

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
    });

    it('rejects reserved map_to values', () => {
        const mapping = createValidProjectMapping();
        mapping[0].forms[FORM_REF][INPUT_REF].map_to = 'ec5_uuid';

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(false);
        expect(result.errors?.some((error) => error.instancePath.includes('map_to'))).toBe(true);
    });

    it('rejects map_to values with invalid characters', () => {
        const mapping = createValidProjectMapping();
        mapping[0].forms[FORM_REF][INPUT_REF].map_to = 'bad-name';

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(false);
        expect(result.errors?.some((error) => error.instancePath.includes('map_to'))).toBe(true);
    });

    it('rejects map_to values longer than 20 characters', () => {
        const mapping = createValidProjectMapping();
        mapping[0].forms[FORM_REF][INPUT_REF].map_to = 'abcdefghijklmnopqrstu';

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(false);
        expect(result.errors?.some((error) => error.instancePath.includes('map_to'))).toBe(true);
    });

    it('rejects mapping entries missing required fields', () => {
        const mapping = createValidProjectMapping();
        delete mapping[0].forms[FORM_REF][INPUT_REF].hide;

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(false);
        expect(result.errors?.some((error) => error.message?.includes('required property'))).toBe(true);
    });

    it('accepts non-empty object-shaped group/branch/possible_answers in project_mapping', () => {
        const mapping = createValidProjectMapping();
        const nestedInputRef = `${INPUT_REF}_${'e'.repeat(13)}`;
        mapping[0].forms[FORM_REF][INPUT_REF].group = {
            [nestedInputRef]: {
                hide: false,
                group: [],
                branch: [],
                map_to: 'nested_group_field',
                possible_answers: []
            }
        };
        mapping[0].forms[FORM_REF][INPUT_REF].branch = {
            [nestedInputRef]: {
                hide: false,
                group: [],
                branch: [],
                map_to: 'nested_branch_field',
                possible_answers: []
            }
        };
        mapping[0].forms[FORM_REF][INPUT_REF].possible_answers = {
            [ANSWER_REF]: {
                map_to: 'OptionA'
            }
        };

        const result = projectJsonValidate.isValidProjectMapping(mapping);

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
    });
});

describe('project_mapping reference integrity', () => {
    it('accepts mapping references that exist in project_extra', () => {
        expect(() => projectMappingService.validateProjectMappingReferences(createValidProjectMapping(), createProjectExtra()))
            .not.toThrow();
    });

    it('throws when mapping references an unknown form', () => {
        const mapping = createValidProjectMapping();
        const invalidForms = {
            [PROJECT_REF]: mapping[0].forms[FORM_REF]
        };
        mapping[0].forms = invalidForms;

        expect(() => projectMappingService.validateProjectMappingReferences(mapping, createProjectExtra()))
            .toThrow(/form ref/);
    });

    it('throws when mapping references an unknown input', () => {
        const mapping = createValidProjectMapping();
        const unknownInputRef = `${FORM_REF}_${'e'.repeat(13)}`;
        mapping[0].forms[FORM_REF] = {
            [unknownInputRef]: mapping[0].forms[FORM_REF][INPUT_REF]
        };

        expect(() => projectMappingService.validateProjectMappingReferences(mapping, createProjectExtra()))
            .toThrow(/input ref/);
    });
});
