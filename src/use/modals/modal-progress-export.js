import { modalController } from '@ionic/vue';
import ModalProgressExport from '@/components/modals/ModalProgressExport';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

export function modalProgressExport() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    const showModal = async () => {
        rootStore.isExportModalActive = true;
        const modal = await modalController.create({
            cssClass: 'modal-progress-export',
            component: ModalProgressExport,
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {
                header: labels.exporting
            }
        });
        return modal.present();
    };

    return {
        showModal
    };
}
