import { DB_ERRORS, PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model.js';
import { useRootStore } from '@/stores/root-store';
import { showModalLogin } from '@/use/show-modal-login';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { downloadFileService } from '@/services/download-file-service';
import { webService } from '@/services/web-service';
import { logout } from '@/use/logout';

//imp: router gets passed because is available only in setup()
export async function addProject(project, router) {

    let noInputs;
    const authErrors = PARAMETERS.AUTH_ERROR_CODES;
    const rootStore = useRootStore();

    await notificationService.showProgressDialog(
        STRINGS[rootStore.language].labels.wait,
        STRINGS[rootStore.language].labels.loading_project
    );
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                const response = await webService.getProject(project.slug);

                const data = response.data;
                // Check we have project
                if (data.meta.project_extra) {
                    // Load project extra structure into project model
                    projectModel.loadExtraStructure(data.meta.project_extra);
                    // Get number of inputs for this project
                    noInputs = projectModel.getExtraInputs().length === 0;
                    // Remove project model
                    projectModel.destroy();

                    // If no inputs, do not allow user to add this project
                    if (noInputs) {
                        notificationService.hideProgressDialog();
                        notificationService.showAlert(
                            STRINGS[rootStore.language].status_codes.ec5_133
                        );
                    } else {
                        try {
                            //insert project to sqlite database
                            await databaseInsertService.insertProject(
                                project.slug,
                                project.name,
                                project.ref,
                                JSON.stringify(data.meta.project_extra),
                                rootStore.serverUrl,
                                data.meta.project_stats.structure_last_updated,
                                JSON.stringify(data.meta.project_mapping)
                            );

                            try {
                                // Attempt to download the project logo
                                await downloadFileService.downloadProjectLogo(
                                    project.slug,
                                    project.ref
                                );

                                window.setTimeout(function () {
                                    // notificationService.hideProgressDialog();
                                    notificationService.showToast(
                                        STRINGS[rootStore.language].status_codes.ec5_112
                                    );
                                    router.replace({
                                        name: PARAMETERS.ROUTES.PROJECTS,
                                        query: { refresh: true }
                                    });
                                    resolve();
                                }, PARAMETERS.DELAY_MEDIUM);
                            } catch (error) {
                                // Error
                                // todo: how to handle this?
                                notificationService.showToast(
                                    STRINGS[rootStore.language].status_codes.ec5_138
                                );

                                window.setTimeout(function () {
                                    // notificationService.hideProgressDialog();
                                    notificationService.showToast(
                                        STRINGS[rootStore.language].status_codes.ec5_112
                                    );
                                    router.replace({
                                        name: 'projects',
                                        query: { refresh: false }
                                    });
                                    resolve();
                                }, PARAMETERS.DELAY_MEDIUM);
                            }
                        } catch (error) {
                            let errorCode = DB_ERRORS[error.code];
                            // Project already exists error
                            if (errorCode === 'ec5_109') {
                                errorCode = 'ec5_111';
                            }
                            notificationService.hideProgressDialog();
                            notificationService.showAlert(
                                STRINGS[rootStore.language].status_codes[errorCode]
                            );
                            resolve();
                        }
                    }
                } else {
                    // Web error
                    notificationService.hideProgressDialog();
                    errorsService.handleWebError({ data: 'ec5_116' });
                    resolve();
                }
            } catch (error) {
                // Web error
                notificationService.hideProgressDialog();
                /*
                     ec5_77: user is not logged in (or jwt expired)
                     ec5_78: user is logged but cannot access the project
                     */
                const errorCode = error.data.errors[0].code;

                // Check if we have an auth error
                if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
                    const confirmed = await notificationService.confirmSingle(
                        STRINGS[rootStore.language].status_codes[
                        error.data.errors[0].code
                        ]
                    );

                    if (confirmed) {
                        //if error code is ec5_78 it means the user has no role in the requested project
                        if (errorCode !== 'ec5_78') {
                            //the user is not logged in, so:
                            //1 - set a callback to add the project after logging in
                            rootStore.afterUserIsLoggedIn = {
                                callback: addProject,
                                params: [project, router]
                            };
                            //2- Clear any token and ask user to login again
                            await logout();
                            showModalLogin();
                        }
                    }
                } else {
                    // Other error
                    errorsService.handleWebError(error);
                }
                resolve();
            }
        })();
    });
}