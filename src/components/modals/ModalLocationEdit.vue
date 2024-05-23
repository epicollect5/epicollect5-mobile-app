<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content class="animate__animated animate__fadeIn">

		<ion-toolbar
			color="dark"
			mode="md"
			class="ion-text-center ion-text-uppercase"
		>
			<ion-title>{{ labels.update_location }}</ion-title>
		</ion-toolbar>

		<ion-card class="ion-margin">
			<ion-card-header class="question-label ion-margin-bottom">
				<ion-card-subtitle class="ion-text-left">
					{{ labels.format }}:&nbsp;lat, long</ion-card-subtitle>
			</ion-card-header>
			<ion-card-content class="ion-text-center">
				<ion-item
					lines="none"
					class="item-question-location-edit"
				>
					<ion-input
						inputmode="text"
						class="question-input"
						placeholder="i.e. 51.509865, -0.118092"
						v-model="state.value"
						:clear-input="true"
					/>
				</ion-item>
				<grid-question-wide class="ion-margin-top">
					<template #content>
						<ion-button
							class="question-action-button ion-text-nowrap"
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
					</template>
				</grid-question-wide>
			</ion-card-content>
		</ion-card>
	</ion-content>
</template>

<script>
import { closeOutline, locate, mapSharp } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import HeaderModal from '@/components/HeaderModal.vue';
import GridQuestionWide from '@/components/GridQuestionWide';
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
					//sanitise (decimal commas instead of dot in some regions, etc)
					const coords = utilsService.extractCoordinates(state.value);
					modalController.dismiss({
						latitude: coords.latitude,
						longitude: coords.longitude
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
			locate,
			mapSharp
		};
	}
};
</script>