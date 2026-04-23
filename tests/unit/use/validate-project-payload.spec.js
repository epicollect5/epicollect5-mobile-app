import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/services/project-extra-service', () => ({
    default: {
        generateExtraStructure: vi.fn()
    }
}));

vi.mock('@/services/project-mapping-service', () => ({
    default: {
        createEC5AUTOMapping: vi.fn(),
        validateProjectMappingReferences: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        formatAjvError: vi.fn()
    }
}));

vi.mock('@/services/validation/project-json-validate', () => ({
    projectJsonValidate: {
        preValidateProjectStructure: vi.fn(),
        sanitiseAngleBrackets: vi.fn(),
        isValidAgainstSchema: vi.fn(),
        performDeepValidation: vi.fn(),
        isValidProjectMapping: vi.fn()
    }
}));

vi.mock('@/services/validation/project-json-sanitise', () => ({
    projectJsonSanitise: {
        sanitiseProjectDefinitionForImport: vi.fn()
    }
}));

describe('validateProjectPayload', () => {
    let validateProjectPayload;
    let projectExtraService;
    let projectMappingService;
    let errorsService;
    let projectJsonValidate;
    let projectJsonSanitise;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        ({validateProjectPayload} = await import('@/use/project/validate-project-payload'));
        ({default: projectExtraService} = await import('@/services/project-extra-service'));
        ({default: projectMappingService} = await import('@/services/project-mapping-service'));
        ({errorsService} = await import('@/services/errors-service'));
        ({projectJsonValidate} = await import('@/services/validation/project-json-validate'));
        ({projectJsonSanitise} = await import('@/services/validation/project-json-sanitise'));

        projectJsonValidate.preValidateProjectStructure.mockReturnValue(true);
        projectJsonSanitise.sanitiseProjectDefinitionForImport.mockImplementation((data) => data);
        projectJsonValidate.sanitiseAngleBrackets.mockImplementation((content) => content);
        projectJsonValidate.isValidAgainstSchema.mockReturnValue({isValid: true, errors: null});
        projectJsonValidate.performDeepValidation.mockReturnValue(true);
        projectJsonValidate.isValidProjectMapping.mockReturnValue({isValid: true, errors: null});
        projectExtraService.generateExtraStructure.mockReturnValue({forms: {}, inputs: {}});
        projectMappingService.createEC5AUTOMapping.mockReturnValue({name: 'EC5_AUTO'});
        projectMappingService.validateProjectMappingReferences.mockReturnValue(true);
        errorsService.formatAjvError.mockReturnValue('pretty');
    });

    it('returns validated project payload with generated mapping', async () => {
        const result = await validateProjectPayload({
            data: {
                project: {
                    ref: 'project-ref',
                    slug: 'project-slug',
                    name: 'Project Name'
                }
            }
        }, 'en');

        expect(result.projectLabel).toBe('project-slug');
        expect(result.projectDefinition.meta.project_mapping).toEqual([{name: 'EC5_AUTO'}]);
    });

    it('throws a validation alert payload when schema validation fails', async () => {
        projectJsonValidate.isValidAgainstSchema.mockReturnValue({
            isValid: false,
            errors: [{instancePath: '/data/project', message: 'bad'}]
        });

        await expect(validateProjectPayload({
            data: {
                project: {
                    ref: 'project-ref',
                    slug: 'project-slug',
                    name: 'Project Name'
                }
            }
        }, 'en')).rejects.toMatchObject({
            useValidationAlert: true,
            projectLabel: 'project-slug',
            htmlMessage: 'pretty'
        });
    });
});
