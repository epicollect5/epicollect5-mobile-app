<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content class="animate__animated animate__fadeIn">

		<ion-toolbar
			color="dark"
			mode="md"
			class="ion-text-center ion-text-uppercase"
		>
			<ion-subtitle data-translate="update_location">
				{{ labels.update_location }}
			</ion-subtitle>
		</ion-toolbar>

		<ion-card class="ion-margin">
			<ion-card-header class="question-label ion-margin-bottom">
				<ion-card-subtitle class="ion-text-left">
					<span data-translate="format">{{ labels.format }}</span>:&nbsp;lat, long
				</ion-card-subtitle>
			</ion-card-header>
			<ion-card-content class="ion-text-center">
				<ion-item fill="outline">
					<ion-input
						inputmode="text"
						class="question-input"
						placeholder="i.e. 51.509865, -0.118092"
						v-model="state.value"
						:clear-input="true"
					/>
				</ion-item>
				<grid-question-wide class="ion-margin-top">
					<ion-button
						data-test="update-location"
						data-translate="update_location"
						class="question-action-button"
						color="secondary"
						expand="block"
						@click="updateLocation()"
					>
						<ion-icon
							slot="start"
							:icon="locate"
						></ion-icon>
						{{ labels.update_location }}
					</ion-button>
				</grid-question-wide>
			</ion-card-content>
		</ion-card>
	</ion-content>
</template>

<script>
import { closeOutline, locate } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import HeaderModal from '@/components/HeaderModal.vue';
import GridQuestionWide from '@/components/GridQuestionWide.vue';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';

export default {
	components: { HeaderModal, GridQuestionWide },
	props: {
		latitude: {
			type: String,
			required: true
		},
		longitude: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const value =
			props.latitude && props.latitude ? [props.latitude, props.longitude].join(', ') : '';

		const state = reactive({
			value
		});

		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			updateLocation() {
				if (utilsService.isValidDecimalDegreesString(state.value)) {
					modalController.dismiss({
						latitude: state.value.split(',')[0].trim(),
						longitude: state.value.split(',')[1].trim()
					});
				} else {
					notificationService.showAlert(labels.invalid_value);
				}
			}
		};

		return {
			labels,
			state,
			...methods,
			//icons
			closeOutline,
			locate
		};
	}
};
</script>