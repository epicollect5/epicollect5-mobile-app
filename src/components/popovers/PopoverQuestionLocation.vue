<template>
	<ion-content v-show="state.visible">
		<ion-list class="ion-no-padding ion-no-margin">
			<ion-item
				button
				lines="full"
				@click="openModalLocationEdit()"
			>
				<ion-icon
					slot="start"
					:icon="create"
				></ion-icon>
				<ion-label>{{ labels.edit }}</ion-label>
			</ion-item>
			<ion-item
				button
				:disabled="!hasLatLong"
				lines="full"
				@click="viewOnOrganicMaps()"
			>
				<ion-icon
					slot="start"
					:icon="location"
				></ion-icon>
				<ion-label>
					{{ labels.view_on }} Organic Maps
					<sup>
						<small>Beta</small>
					</sup>
				</ion-label>
			</ion-item>
			<ion-item
				button
				:disabled="!hasLatLong"
				lines="full"
				@click="viewOnGoogleMaps()"
			>
				<ion-icon
					slot="start"
					:icon="mapOutline"
				></ion-icon>
				<ion-label>{{ labels.view_on }} Google Maps
					<sup>
						<small>Beta</small>
					</sup>
				</ion-label>
			</ion-item>
			<ion-item
				button
				:disabled="!hasLatLong"
				lines="full"
				@click="viewOnHereMaps()"
			>
				<ion-icon
					slot="start"
					:icon="navigateCircleOutline"
				></ion-icon>
				<ion-label>{{ labels.view_on }} Here Maps
					<sup>
						<small>Beta</small>
					</sup>
				</ion-label>
			</ion-item>
		</ion-list>
	</ion-content>
</template>

<script>
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { popoverController } from '@ionic/vue';
import { reactive, computed } from '@vue/reactivity';
import { trash, shareSocial, create, mapOutline, location, navigateCircleOutline } from 'ionicons/icons';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import ModalLocationEdit from '@/components/modals/ModalLocationEdit.vue';
import { utilsService } from '@/services/utilities/utils-service';

export default {
	props: {
		parentState: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			visible: true
		});
		const scope = {};

		const methods = {
			async openModalLocationEdit() {
				state.visible = false;
				scope.ModalLocationEdit = await modalController.create({
					cssClass: 'modal-location-edit',
					component: ModalLocationEdit,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						latitude: props.parentState.answer.answer.latitude,
						longitude: props.parentState.answer.answer.longitude
					}
				});

				//update location only when modal is dismiss with "Update Location"
				//imp: using scope.ModalLocationEdit.onWillDismiss() thrown an error
				//Uncaught (in promise) TypeError: Cannot read properties of null (reading 'nextSibling')
				//maybe a race condition?
				scope.ModalLocationEdit.onDidDismiss().then((response) => {
					console.log('coords ->', response.data);
					popoverController.dismiss(response.data ?? null);
				});

				return scope.ModalLocationEdit.present();
			},
			viewOnOrganicMaps() {
				state.visible = false;
				const latitude = props.parentState.answer.answer.latitude;
				const longitude = props.parentState.answer.answer.longitude;

				if (!latitude || !longitude) {
					return false;
				}

				const omURL = PARAMETERS.MAPS_ENDPOINT.OM + latitude + ',' + longitude;
				popoverController.dismiss(null);
				window.open(omURL, '_system', 'location="yes"');
			},
			viewOnGoogleMaps() {
				state.visible = false;
				const latitude = props.parentState.answer.answer.latitude;
				const longitude = props.parentState.answer.answer.longitude;

				if (!latitude || !longitude) {
					return false;
				}

				const gmURL = PARAMETERS.MAPS_ENDPOINT.GM + latitude + ',' + longitude;
				popoverController.dismiss(null);
				window.open(gmURL, '_system', 'location="yes"');
			},
			viewOnHereMaps() {
				state.visible = false;
				const latitude = props.parentState.answer.answer.latitude;
				const longitude = props.parentState.answer.answer.longitude;

				if (!latitude || !longitude) {
					return false;
				}

				const hmURL = PARAMETERS.MAPS_ENDPOINT.HM + latitude + ',' + longitude;
				popoverController.dismiss(null);
				window.open(hmURL, '_system', 'location="yes"');
			}

		};

		const computedScope = {
			isPWA: computed(() => {
				return rootStore.isPWA;
			}),
			hasLatLong: computed(() => {
				const latitude = props.parentState.answer.answer.latitude;
				const longitude = props.parentState.answer.answer.longitude;
				return (latitude && longitude);
			})
		};

		return {
			labels,
			state,
			...methods,
			...computedScope,
			//icons
			trash,
			shareSocial,
			create,
			mapOutline,
			location,
			navigateCircleOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>