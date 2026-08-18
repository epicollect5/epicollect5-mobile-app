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
				<ion-label class="ion-text-nowrap">{{ labels.edit }}</ion-label>
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
				<ion-label class="ion-text-nowrap">
					{{ labels.view_on }}: <br /> Organic Maps
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
				<ion-label class="ion-text-nowrap">{{ labels.view_on }}: <br /> Google Maps
					<sup>
						<small>Beta</small>
					</sup>
				</ion-label>
			</ion-item>
			<ion-item
				button
				:disabled="!hasLatLong"
				lines="full"
				@click="viewOnHereWeGoMaps()"
			>
				<ion-icon
					slot="start"
					:icon="navigateCircleOutline"
				></ion-icon>
				<ion-label class="ion-text-nowrap">{{ labels.view_on }}: <br />Here WeGo Maps
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
				//imp: dismiss the popover first so we never stack overlays on top of each other,
				//imp: dismissing a closed popover throws "overlay does not exist" and stacked
				//imp: teardowns cause "Cannot read properties of null (reading 'nextSibling')"
				try {
					await popoverController.dismiss();
				} catch (error) {
					if (error !== 'overlay does not exist') {
						throw error;
					}
				}

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
				scope.ModalLocationEdit.onDidDismiss().then((response) => {
					console.log('coords ->', response.data);
					if (response.data) {
						//parentState is the reactive question state passed by the popover handler,
						//writing to it is the intended way to propagate the updated answer
						/* eslint-disable vue/no-mutating-props */
						props.parentState.answer.answer = {
							latitude: response.data.latitude,
							longitude: response.data.longitude,
							accuracy: PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY
						};
						/* eslint-enable vue/no-mutating-props */
					}
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
			viewOnHereWeGoMaps() {
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

<style src="@/theme/components/popovers/PopoverQuestionLocation.scss" lang="scss"></style>
