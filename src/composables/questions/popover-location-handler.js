import { PARAMETERS } from '@/config';
import { popoverController } from '@ionic/vue';
import PopoverQuestionLocation from '@/components/popovers/PopoverQuestionLocation';

export async function popoverLocationHandler({ state }) {

    const popover = await popoverController.create({
        component: PopoverQuestionLocation,
        componentProps: {
            parentState: state
        },
        cssClass: 'popover-question-location',
        animated: false,
        reference: 'trigger',
        side: 'center'
    });
    popover.onDidDismiss().then((response) => {
        if (response.data) {
            state.answer.answer = {
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                accuracy: PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY
            };
        }
        console.log(response);
    });
    return popover.present();
}