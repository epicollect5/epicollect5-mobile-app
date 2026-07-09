import {DB_ERRORS, PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {notificationService} from '@/services/notification-service';
import {projectLogoService} from '@/services/project-logo-service';
import {validateProjectPayload} from '@/composables/project/validate-project-payload';

//imp: router gets passed in because is available only in setup()
export async function importProject(file, router) {
    const rootStore = useRootStore();

    // Helper to finish import with delay, navigation, and toast
    const finishImport = async (refresh) => {
        await new Promise((resolve) => window.setTimeout(resolve, PARAMETERS.DELAY_MEDIUM));
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

        try {

            //bail out if project ref already in the database
            const projectRefExists = await databaseSelectService.projectRefExists(project.ref);
            if (projectRefExists) {
                notificationService.hideProgressDialog();
                await notificationService.showAlert(
                    STRINGS[rootStore.language].status_codes.ec5_111
                );
                return false;
            }

            //bail out if project name already in the database
            const projectNameExists = await databaseSelectService.projectNameExists(project.name);
            if (projectNameExists) {
                notificationService.hideProgressDialog();
                await notificationService.showAlert(
                    STRINGS[rootStore.language].status_codes.ec5_111
                );
                return false;
            }

            //bail out if project slug already in the database
            const projectSlugExists = await databaseSelectService.projectSlugExists(project.slug);
            if (projectSlugExists) {
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

            rootStore.wasProjectImportedFromFile = true;

            try {
                // Generate and Save Logo
                await projectLogoService.generateLocally(project.name, project.ref);
                return await finishImport(true);
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
