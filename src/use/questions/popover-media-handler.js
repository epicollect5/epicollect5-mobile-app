import { PARAMETERS } from '@/config';
import { popoverController } from '@ionic/vue';
import { projectModel } from '@/models/project-model';
import { useRootStore } from '@/stores/root-store';
import PopoverQuestionMedia from '@/components/popovers/PopoverQuestionMedia';

export async function popoverMediaHandler ({ media, entryUuid, state, e, mediaType }) {

    const rootStore = useRootStore();
    const projectRef = projectModel.getProjectRef();
    const inputRef = state.inputDetails.ref;
    let mediaFolder = '';
    switch (mediaType) {
        case PARAMETERS.QUESTION_TYPES.AUDIO:
            mediaFolder = PARAMETERS.AUDIO_DIR;
            break;
        case PARAMETERS.QUESTION_TYPES.PHOTO:
            mediaFolder = PARAMETERS.PHOTO_DIR;
            break;
        case PARAMETERS.QUESTION_TYPES.VIDEO:
            mediaFolder = PARAMETERS.VIDEO_DIR;
            break;
        default:
        //
    }

    const popover = await popoverController.create({
        event: e,
        component: PopoverQuestionMedia,
        componentProps: {
            projectRef,
            media,
            entryUuid,
            inputRef,
            mediaFolder,
            mediaType
        },
        cssClass: 'popover-question-media',
        animated: false,
        reference: 'trigger',
        side: 'left'
    });
    popover.onDidDismiss().then((response) => {
        //update UI only when file gets deleted or queued
        const actions = [PARAMETERS.ACTIONS.FILE_DELETED, PARAMETERS.ACTIONS.FILE_QUEUED];

        if (actions.includes(response.data)) {
            state.filename = '';
            state.fileSource = '';
            if (mediaType === PARAMETERS.QUESTION_TYPES.PHOTO) {
                state.imageSource = '';
            }
            //imp: remove any reference in the media object
            //imp: otherwise deleted media files are still referenced
            //imp: in the answers array (entriesAdd)
            media[entryUuid][inputRef].cached = '';
            media[entryUuid][inputRef].stored = '';
            if (rootStore.device.platform === PARAMETERS.PWA) {
                media[entryUuid][inputRef].filenamePWA = '';
            }
        }
        //reset answer to empty only when file gets deleted (cached files only)
        if (response.data === PARAMETERS.ACTIONS.FILE_DELETED) {
            state.answer.answer = '';
        }
    });
    return popover.present();
}