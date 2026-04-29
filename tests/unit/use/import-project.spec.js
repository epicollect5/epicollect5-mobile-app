import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'Please wait',
                loading_project: 'Loading project'
            },
            status_codes: {
                ec5_112: 'Imported',
                ec5_138: 'Logo failed',
                ec5_111: 'Project exists'
            }
        }
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertProject: vi.fn()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        projectRefExists: vi.fn(),
        projectNameExists: vi.fn(),
        projectSlugExists: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showToast: vi.fn(),
        showValidationErrorAlert: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/project-logo-service', () => ({
    projectLogoService: {
        generateLocally: vi.fn()
    }
}));

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

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        loadExtraStructure: vi.fn(),
        destroy: vi.fn()
    }
}));

const createBasePayload = () => ({
    data: {
        id: 'a'.repeat(32),
        type: 'project',
        project: {
            ref: 'a'.repeat(32),
            name: 'Test Project',
            slug: 'test-project'
        }
    }
});

describe('importProject', () => {
    let importProject;
    let useRootStore;
    let databaseInsertService;
    let databaseSelectService;
    let notificationService;
    let projectLogoService;
    let projectExtraService;
    let projectMappingService;
    let errorsService;
    let projectJsonValidate;
    let projectJsonSanitise;

    const router = {
        replace: vi.fn()
    };

    const projectExtra = {
        forms: {},
        inputs: {}
    };

    const generatedMapping = {
        name: 'EC5_AUTO',
        forms: {},
        map_index: 0,
        is_default: true
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setActivePinia(createPinia());

        vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
            callback();
            return 0;
        });

        ({importProject} = await import('@/composables/project/import-project'));
        ({useRootStore} = await import('@/stores/root-store'));
        ({databaseInsertService} = await import('@/services/database/database-insert-service'));
        ({databaseSelectService} = await import('@/services/database/database-select-service'));
        ({notificationService} = await import('@/services/notification-service'));
        ({projectLogoService} = await import('@/services/project-logo-service'));
        ({default: projectExtraService} = await import('@/services/project-extra-service'));
        ({default: projectMappingService} = await import('@/services/project-mapping-service'));
        ({errorsService} = await import('@/services/errors-service'));
        ({projectJsonValidate} = await import('@/services/validation/project-json-validate'));
        ({projectJsonSanitise} = await import('@/services/validation/project-json-sanitise'));

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.wasProjectImportedFromFile = false;

        projectJsonValidate.preValidateProjectStructure.mockReturnValue(true);
        projectJsonSanitise.sanitiseProjectDefinitionForImport.mockImplementation((data) => data);
        projectJsonValidate.sanitiseAngleBrackets.mockImplementation((content) => content);
        projectJsonValidate.isValidAgainstSchema.mockReturnValue({isValid: true, errors: null});
        projectJsonValidate.performDeepValidation.mockReturnValue(true);
        projectJsonValidate.isValidProjectMapping.mockReturnValue({isValid: true, errors: null});

        projectExtraService.generateExtraStructure.mockReturnValue(projectExtra);
        projectMappingService.createEC5AUTOMapping.mockReturnValue(generatedMapping);
        projectMappingService.validateProjectMappingReferences.mockReturnValue(true);

        databaseSelectService.projectRefExists.mockResolvedValue(false);
        databaseSelectService.projectNameExists.mockResolvedValue(false);
        databaseSelectService.projectSlugExists.mockResolvedValue(false);
        databaseInsertService.insertProject.mockResolvedValue(true);
        projectLogoService.generateLocally.mockResolvedValue(true);

        errorsService.formatAjvError.mockReturnValue('formatted-error');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('imports successfully and uses generated mapping when meta.project_mapping is absent', async () => {
        const payload = createBasePayload();
        const result = await importProject(payload, router);
        const rootStore = useRootStore();

        expect(result).toBe(true);
        expect(projectMappingService.validateProjectMappingReferences).not.toHaveBeenCalled();
        expect(databaseInsertService.insertProject).toHaveBeenCalledWith(
            'test-project',
            'Test Project',
            'a'.repeat(32),
            JSON.stringify(projectExtra),
            '',
            undefined,
            JSON.stringify([generatedMapping])
        );
        expect(rootStore.wasProjectImportedFromFile).toBe(true);
        expect(router.replace).toHaveBeenCalledTimes(1);
    });

    it('uses meta.project_mapping when present and valid', async () => {
        const providedMapping = [
            {
                name: 'EC5_AUTO',
                forms: {},
                map_index: 0,
                is_default: true
            }
        ];

        const payload = {
            ...createBasePayload(),
            meta: {
                project_mapping: providedMapping
            }
        };

        const result = await importProject(payload, router);

        expect(result).toBe(true);
        expect(projectJsonValidate.isValidProjectMapping).toHaveBeenCalledWith(providedMapping, 'en');
        expect(projectMappingService.validateProjectMappingReferences).toHaveBeenCalledWith(providedMapping, projectExtra);
        expect(databaseInsertService.insertProject).toHaveBeenCalledWith(
            'test-project',
            'Test Project',
            'a'.repeat(32),
            JSON.stringify(projectExtra),
            '',
            undefined,
            JSON.stringify(providedMapping)
        );
    });

    it('does not import a project when the project ref already exists locally', async () => {
        const payload = createBasePayload();

        databaseSelectService.projectRefExists.mockResolvedValue(true);

        const result = await importProject(payload, router);

        expect(result).toBe(false);
        expect(databaseSelectService.projectRefExists).toHaveBeenCalledWith('a'.repeat(32));
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project exists');
    });

    it('does not import a project when the project name already exists locally', async () => {
        const payload = createBasePayload();

        databaseSelectService.projectNameExists.mockResolvedValue(true);

        const result = await importProject(payload, router);

        expect(result).toBe(false);
        expect(databaseSelectService.projectRefExists).toHaveBeenCalledWith('a'.repeat(32));
        expect(databaseSelectService.projectNameExists).toHaveBeenCalledWith('Test Project');
        expect(databaseSelectService.projectSlugExists).not.toHaveBeenCalled();
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project exists');
    });

    it('does not import a project when the project slug already exists locally', async () => {
        const payload = createBasePayload();

        databaseSelectService.projectSlugExists.mockResolvedValue(true);

        const result = await importProject(payload, router);

        expect(result).toBe(false);
        expect(databaseSelectService.projectRefExists).toHaveBeenCalledWith('a'.repeat(32));
        expect(databaseSelectService.projectNameExists).toHaveBeenCalledWith('Test Project');
        expect(databaseSelectService.projectSlugExists).toHaveBeenCalledWith('test-project');
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project exists');
    });

    it('fails import when meta.project_mapping is present but invalid', async () => {
        const payload = {
            ...createBasePayload(),
            meta: {
                project_mapping: []
            }
        };

        projectJsonValidate.isValidProjectMapping.mockReturnValue({
            isValid: false,
            errors: [{instancePath: '/0/forms', message: 'must be object'}]
        });

        const result = await importProject(payload, router);

        expect(result).toBe(false);
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            'Invalid meta.project_mapping at "/0/forms": must be object'
        );
    });

    it('shows schema validation alert when project payload fails schema validation', async () => {
        const payload = createBasePayload();
        const schemaErrors = [{instancePath: '/data/project', message: 'must have required property'}];

        projectJsonValidate.isValidAgainstSchema.mockReturnValue({
            isValid: false,
            errors: schemaErrors
        });

        const result = await importProject(payload, router);

        expect(result).toBe(false);
        expect(notificationService.showValidationErrorAlert).toHaveBeenCalledWith(
            'formatted-error',
            expect.any(String)
        );
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
    });

    it('continues import when logo generation fails and refresh flag is false', async () => {
        const payload = createBasePayload();

        projectLogoService.generateLocally.mockRejectedValue(new Error('logo failed'));

        const result = await importProject(payload, router);
        const rootStore = useRootStore();

        expect(result).toBe(true);
        expect(rootStore.wasProjectImportedFromFile).toBe(false);
        expect(router.replace).toHaveBeenCalledWith(
            expect.objectContaining({
                query: {
                    refresh: false
                }
            })
        );
    });
});
