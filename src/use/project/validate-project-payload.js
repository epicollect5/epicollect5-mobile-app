import projectExtraService from '@/services/project-extra-service';
import projectMappingService from '@/services/project-mapping-service';
import {errorsService} from '@/services/errors-service';
import {projectJsonValidate} from '@/services/validation/project-json-validate';
import {projectJsonSanitise} from '@/services/validation/project-json-sanitise';

function createError(message, extras = {}) {
    const error = new Error(message);
    Object.assign(error, extras);
    return error;
}

function getProjectIdentityFromEnvelope(content, fallback = 'Unknown project') {
    const project = content?.data?.project || {};
    return project.slug || project.name || project.ref || fallback;
}

async function normalizeProjectData(input) {
    let raw;

    if (input instanceof File || input instanceof Blob) {
        raw = await input.text();
    } else {
        raw = input;
    }

    const json = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!json || typeof json !== 'object') {
        throw createError('Invalid JSON input');
    }

    if (json.data) {
        return {
            data: json.data,
            ...(json.meta !== undefined ? {meta: json.meta} : {})
        };
    }

    return {data: json};
}

export async function validateProjectPayload(input, language) {
    let content = await normalizeProjectData(input);
    const fallbackLabel = getProjectIdentityFromEnvelope(content);

    projectJsonValidate.preValidateProjectStructure(content, language);
    content.data = projectJsonSanitise.sanitiseProjectDefinitionForImport(content.data);
    content = projectJsonValidate.sanitiseAngleBrackets(content);

    const validator = projectJsonValidate.isValidAgainstSchema(content, language);

    if (!validator.isValid) {
        throw createError(
            `Schema validation failed for ${getProjectIdentityFromEnvelope(content, fallbackLabel)}`,
            {
                useValidationAlert: true,
                htmlMessage: errorsService.formatAjvError(validator.errors, content),
                plainText: JSON.stringify({errors: validator.errors, data: content}, null, 2),
                projectLabel: getProjectIdentityFromEnvelope(content, fallbackLabel)
            }
        );
    }

    projectJsonValidate.performDeepValidation(content, language);

    const projectDefinition = content.data;
    const projectMeta = content.meta || {};
    const projectExtra = projectExtraService.generateExtraStructure(projectDefinition);
    let projectMapping = [projectMappingService.createEC5AUTOMapping(projectExtra)];

    if (Object.prototype.hasOwnProperty.call(projectMeta, 'project_mapping')) {
        const projectMappingValidation = projectJsonValidate.isValidProjectMapping(
            projectMeta.project_mapping,
            language
        );

        if (!projectMappingValidation.isValid) {
            const firstError = projectMappingValidation.errors?.[0];
            const mappingPath = firstError?.instancePath || '/meta/project_mapping';
            const mappingError = firstError?.message || 'Invalid schema.';

            throw createError(
                `Invalid meta.project_mapping at "${mappingPath}": ${mappingError}`,
                {
                    projectLabel: getProjectIdentityFromEnvelope(content, fallbackLabel)
                }
            );
        }

        projectMappingService.validateProjectMappingReferences(projectMeta.project_mapping, projectExtra);
        projectMapping = projectMeta.project_mapping;
    }

    projectDefinition.meta = {};
    projectDefinition.meta.project_extra = projectExtra;
    projectDefinition.meta.project_mapping = projectMapping;

    return {
        content,
        projectDefinition,
        projectMeta,
        projectExtra,
        projectMapping,
        project: projectDefinition.project,
        projectLabel: getProjectIdentityFromEnvelope(content, fallbackLabel)
    };
}
