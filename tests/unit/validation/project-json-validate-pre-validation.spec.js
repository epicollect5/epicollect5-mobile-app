import { describe, it, expect, beforeEach } from 'vitest';
import { projectJsonValidate } from '@/services/validation/project-json-validate';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { createMinimalProject } from './test-helpers';

describe('projectJsonValidate - Pre-validation', () => {
    describe('preValidateProjectStructure', () => {
        const errors = STRINGS.en.validation_errors;

        it('passes for valid minimal project structure', () => {
            const project = createMinimalProject();
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).not.toThrow();
        });

        it('throws when data is missing', () => {
            const project = { id: 'test' };
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.missing_data_key);
        });

        it('throws when data.id is missing', () => {
            const project = createMinimalProject();
            delete project.data.id;
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.missing_data_id);
        });

        it('throws when data.type is missing', () => {
            const project = createMinimalProject();
            delete project.data.type;
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.missing_data_type);
        });

        it('throws when data.project is missing', () => {
            const project = createMinimalProject();
            delete project.data.project;
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.missing_data_project);
        });

        it('throws when data.id !== project.ref', () => {
            const project = createMinimalProject();
            project.data.id = 'b'.repeat(32);
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.id_mismatch);
        });

        it('throws when required project metadata key is missing', () => {
            const project = createMinimalProject();
            delete project.data.project.status;
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.missing_project_key_status);
        });

        it('throws when forms array is empty', () => {
            const project = createMinimalProject();
            project.data.project.forms = [];
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.no_forms);
        });

        it('throws when no form has inputs', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs = [];
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'en')).toThrow(errors.no_form_inputs);
        });
    });

    describe('Multi-language validation', () => {
        const allLanguages = [PARAMETERS.DEFAULT_LANGUAGE, ...PARAMETERS.SUPPORTED_LANGUAGES];

        allLanguages.forEach((language) => {
            describe(`Language: ${language}`, () => {
                let projectError;

                beforeEach(() => {
                    projectError = createMinimalProject();
                    delete projectError.data.project;
                });

                it(`returns localized error message in ${language}`, () => {
                    const expectedError = STRINGS[language].validation_errors.missing_data_project;
                    expect(() => projectJsonValidate.preValidateProjectStructure(projectError, language)).toThrow(expectedError);
                });

                it(`validates correctly for ${language} with valid project`, () => {
                    const validProject = createMinimalProject();
                    expect(() => projectJsonValidate.preValidateProjectStructure(validProject, language)).not.toThrow();
                });
            });
        });
    });

    describe('Validation errors consistency across languages', () => {
        const allLanguages = [PARAMETERS.DEFAULT_LANGUAGE, ...PARAMETERS.SUPPORTED_LANGUAGES];
        const enErrors = STRINGS.en.validation_errors;
        const expectedErrorKeys = Object.keys(enErrors);

        allLanguages.forEach((language) => {
            it(`${language} has all required validation_errors keys`, () => {
                expect(STRINGS[language].validation_errors).toBeDefined();
                const languageErrorKeys = Object.keys(STRINGS[language].validation_errors);

                expectedErrorKeys.forEach((key) => {
                    expect(languageErrorKeys).toContain(key);
                });
            });

            it(`${language} has no extra validation_errors keys`, () => {
                const languageErrorKeys = Object.keys(STRINGS[language].validation_errors);
                expect(languageErrorKeys.length).toBe(expectedErrorKeys.length);
            });

            it(`${language} validation_errors all have non-empty string values`, () => {
                const validationErrors = STRINGS[language].validation_errors;

                Object.entries(validationErrors).forEach(([key, value]) => {
                    expect(typeof value).toBe('string');
                    expect(value.length).toBeGreaterThan(0);
                    expect(value.trim()).not.toBe('');
                });
            });

            it(`${language} validation_errors have the correct number of total keys`, () => {
                const validationErrors = STRINGS[language].validation_errors;
                expect(Object.keys(validationErrors).length).toBe(expectedErrorKeys.length);
            });
        });

        it('all languages have identical error key structure', () => {
            const firstLangKeys = Object.keys(STRINGS[allLanguages[0]].validation_errors).sort();

            allLanguages.slice(1).forEach((language) => {
                const currentLangKeys = Object.keys(STRINGS[language].validation_errors).sort();
                expect(currentLangKeys).toEqual(firstLangKeys);
            });
        });
    });

    describe('Fallback to default language', () => {
        it('uses default language (en) when invalid language is provided', () => {
            const project = createMinimalProject();
            delete project.data.id;

            const expectedError = STRINGS.en.validation_errors.missing_data_id;
            expect(() => projectJsonValidate.preValidateProjectStructure(project, 'invalid-lang')).toThrow(expectedError);
        });

        it('uses default language when language is undefined', () => {
            const project = createMinimalProject();
            delete project.data.id;

            const expectedError = STRINGS.en.validation_errors.missing_data_id;
            expect(() => projectJsonValidate.preValidateProjectStructure(project)).toThrow(expectedError);
        });
    });

    describe('Specific error messages per language', () => {
        it('missing_data_key error differs across languages', () => {
            const allLanguages = [PARAMETERS.DEFAULT_LANGUAGE, ...PARAMETERS.SUPPORTED_LANGUAGES];
            const project = { id: 'test' };
            const errors = new Map();

            allLanguages.forEach((language) => {
                try {
                    projectJsonValidate.preValidateProjectStructure(project, language);
                } catch (error) {
                    errors.set(language, error.message);
                }
            });

            // Check that at least English and Italian errors are different
            expect(errors.get('en')).not.toBe(errors.get('it'));
            expect(errors.get('en')).not.toBe(errors.get('es'));
        });
    });
});
