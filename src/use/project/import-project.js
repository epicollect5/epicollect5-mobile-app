import {DB_ERRORS, PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {projectModel} from '@/models/project-model.js';
import {useRootStore} from '@/stores/root-store';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {notificationService} from '@/services/notification-service';
import {projectLogoService} from '@/services/project-logo-service';
import {validateProjectPayload} from '@/use/project/validate-project-payload';

//imp: router gets passed in because is available only in setup()
export async function importProject(file, router) {
    const rootStore = useRootStore();

    await notificationService.showProgressDialog(
        STRINGS[rootStore.language].labels.wait,
        STRINGS[rootStore.language].labels.loading_project
    );

    // Helper to finish import with delay, navigation, and toast
    const finishImport = async (refresh, markImported = false) => {
        await new Promise((resolve) => window.setTimeout(resolve, PARAMETERS.DELAY_MEDIUM));
        if (markImported) {
            rootStore.wasProjectImportedFromFile = true;
        }
        notificationService.hideProgressDialog();
        notificationService.showToast(
            STRINGS[rootStore.language].status_codes.ec5_112
        );

        router.replace({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: { refresh: refresh}
        });
        return true;
    };

    try {
        const {
            projectDefinition,
            project
        } = await validateProjectPayload(file, rootStore.language);

        // Load project extra structure into project model
        projectModel.loadExtraStructure(projectDefinition.meta.project_extra);
        // Remove project model
        projectModel.destroy();

        try {
            const exists = await databaseSelectService.projectExists(project.ref);

            if (exists) {
                notificationService.hideProgressDialog();
                await notificationService.showAlert(
                    STRINGS[rootStore.language].status_codes.ec5_111
                );
                return false;
            }

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
                return await finishImport(true, true);
            } catch (error) {
                // Logo download failed — continue without blocking
                notificationService.showToast(
                    STRINGS[rootStore.language].status_codes.ec5_138
                );
                return await finishImport(false);
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
        if (error?.useValidationAlert) {
            await notificationService.showValidationErrorAlert(error.htmlMessage, error.plainText);
            return false;
        }
        const msg = error?.message || error;
        await notificationService.showAlert(msg);
        return false;
    }
}
