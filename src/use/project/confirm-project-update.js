import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { alertController } from '@ionic/vue';

//Shared update confirm used by the Entries flow (update-local-project) and the
//upload flow (update-project): Learn more opens the docs without deciding,
//Cancel declines, OK starts the update.
export async function confirmProjectUpdate() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    return new Promise((resolve) => {
        (async () => {
            const buttons = [];
            buttons.push({
                text: STRINGS[language].labels.learn_more,
                handler: () => {
                    window.open(PARAMETERS.UPDATE_PROJECT_DOCS_URL, '_system', 'location=yes');
                    return false;
                }
            });
            buttons.push(
                {
                    text: STRINGS[language].labels.cancel,
                    role: 'cancel',
                    handler: () => {
                        resolve(false);
                    }
                },
                {
                    text: STRINGS[language].labels.ok,
                    handler: () => {
                        resolve(true);
                    }
                }
            );
            try {
                const createdAlert = await alertController.create({
                    header: STRINGS[language].labels.project_outdated,
                    message: STRINGS[language].labels.update_project,
                    buttons,
                    cssClass: 'alert-confirm-single-vertical-' + rootStore.device.platform.toLowerCase()
                });
                // Any dismissal route (e.g. Android back) settles as decline:
                // resolve is idempotent, so a late button tap is a safe no-op.
                createdAlert.onDidDismiss().then(() => {
                    resolve(false);
                });
                await createdAlert.present();
            } catch (presentError) {
                console.log('update confirm failed: ' + presentError);
                resolve(false);
            }
        })();
    });
}
