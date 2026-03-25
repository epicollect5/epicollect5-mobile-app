import {DB_ERRORS, PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {projectModel} from '@/models/project-model.js';
import {useRootStore} from '@/stores/root-store';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {notificationService} from '@/services/notification-service';
import {projectLogoService} from '@/services/project-logo-service';
import projectExtraService from '@/services/project-extra-service';
import projectMappingService from '@/services/project-mapping-service';
import {errorsService} from '@/services/errors-service';
import {projectJsonValidate} from '@/services/validation/project-json-validate';

//imp: router gets passed in because is available only in setup()
export async function importProject(file, router) {

    /**
     * Normalizes input: accepts File, String, or Object.
     * Always returns { data: ... }
     */
    const _normalizeProjectData = async (input) => {
        let raw;

        if (input instanceof File || input instanceof Blob) {
            // Modern browsers: .text() is built-in and returns a promise
            raw = await input.text();
        } else {
            raw = input;
        }

        // If it's already an object, we skip parsing. If it's a string, we parse.
        const json = typeof raw === 'string' ? JSON.parse(raw) : raw;

        if (!json || typeof json !== 'object') throw new Error('Invalid JSON input');

        // Return the envelope: use .data if it exists, otherwise the whole object
        return json.data ? {data: json.data} : {data: json};
    };

    const rootStore = useRootStore();

    await notificationService.showProgressDialog(
        STRINGS[rootStore.language].labels.wait,
        STRINGS[rootStore.language].labels.loading_project
    );

    try {
        let content = await _normalizeProjectData(file);
        // Sanitize angle brackets to prevent schema validation failures due to "^[^<>]*$" pattern
        content = projectJsonValidate.sanitiseAngleBrackets(content);
        const validator = projectJsonValidate.isValidAgainstSchema(content);

        if (!validator.isValid) {
            // Ajv provides a detailed array of why it failed
            console.error('Schema Validation Errors:', validator.errors);
            notificationService.hideProgressDialog();
            // Show custom alert with copy option
            const prettyErrorHtml = errorsService.formatAjvError(validator.errors, content);
            const plainTextError = JSON.stringify({ errors: validator.errors, data: content }, null, 2);
            await notificationService.showValidationErrorAlert(prettyErrorHtml, plainTextError);
            return false;
        }

        projectJsonValidate.performDeepValidation(content);

        const projectDefinition = content.data;
        //generate project extra structure from project data
        const projectExtra = projectExtraService.generateExtraStructure(projectDefinition);
        //generate project mapping structure from project data
        const projectMapping = projectMappingService.createEC5AUTOMapping(projectExtra);

        //generate project extra structure
        projectDefinition.meta = {};
        projectDefinition.meta.project_extra = projectExtra;
        projectDefinition.meta.project_mapping = [projectMapping];

        // Load project extra structure into project model
        projectModel.loadExtraStructure(projectDefinition.meta.project_extra);
        // Remove project model
        projectModel.destroy();

        // Extract project metadata
        const project = projectDefinition.project;

        try {
            //insert project to sqlite database
            await databaseInsertService.insertProject(
                project.slug,
                project.name,
                project.ref,
                JSON.stringify(projectDefinition.meta.project_extra),
                '', // We clear server_url for imported projects as they are local-only
                projectDefinition.meta.project_stats?.structure_last_updated,
                JSON.stringify(projectDefinition.meta.project_mapping)
            );

            try {
                // Generate and Save Logo
                await projectLogoService.generateLocally(project.name, project.ref);

                window.setTimeout(function () {
                    rootStore.wasProjectImportedFromFile = true;
                    notificationService.hideProgressDialog();
                    notificationService.showToast(
                        STRINGS[rootStore.language].status_codes.ec5_112
                    );
                    router.replace({
                        name: PARAMETERS.ROUTES.PROJECTS,
                        query: {refresh: true}
                    });
                    return true;
                }, PARAMETERS.DELAY_MEDIUM);
            } catch (error) {
                // Logo download failed — continue without blocking
                notificationService.showToast(
                    STRINGS[rootStore.language].status_codes.ec5_138
                );

                window.setTimeout(function () {
                    notificationService.hideProgressDialog();
                    notificationService.showToast(
                        STRINGS[rootStore.language].status_codes.ec5_112
                    );
                    router.replace({
                        name: PARAMETERS.ROUTES.PROJECTS,
                        query: {refresh: false}
                    });
                    return true;
                }, PARAMETERS.DELAY_MEDIUM);
            }
        } catch (error) {
            let errorCode = DB_ERRORS[error.code];
            // Project already exists error
            if (errorCode === 'ec5_109') {
                errorCode = 'ec5_111';
            }
            notificationService.hideProgressDialog();
            await notificationService.showAlert(
                STRINGS[rootStore.language].status_codes[errorCode]
            );
            return false;
        }

    } catch (error) {
        console.error('Import Project Error:', error);
        notificationService.hideProgressDialog();
        // Show a friendly message for parsing/IO errors or unexpected structure
        const msg = error?.message || error;
        await notificationService.showAlert(msg);
        return false;
    }
}
