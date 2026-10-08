import { modalController } from '@ionic/vue';
import ModalProjectUpdater from '@/components/modals/ModalProjectUpdater.vue';
import { useRootStore } from '@/stores/root-store';

//imp: this presenter lives outside the SFC on purpose: update-local-project
//imports the SFC default export (which carries the compiled render) through
//here. A named export from inside the .vue file would close over the bare
//options object, whose render is tree-shaken away at build because nothing
//imports the default export - the modal then mounts with no output and no
//error (blank updater modal, update hanging on dismiss).
export async function showUpdaterModal(header) {
    const rootStore = useRootStore();
    const modal = await modalController.create({
        cssClass: 'modal-project-updater',
        component: ModalProjectUpdater,
        showBackdrop: true,
        backdropDismiss: false,
        componentProps: {
            header
        }
    });
    rootStore.isProjectUpdateModalActive = true;
    await modal.present();
    return { modal };
}

export async function cleanupUpdateModal(handle) {
    const rootStore = useRootStore();
    if (handle) {
        await handle.modal.dismiss();
    }
    rootStore.isProjectUpdating = false;
    rootStore.isProjectUpdateModalActive = false;
    rootStore.progressUpdate = { total: 0, done: 0 };
    rootStore.updateDone = false;
}
