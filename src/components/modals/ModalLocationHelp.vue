<template>
	<ion-header class="ion-no-border">
		<ion-toolbar color="primary">
			<ion-buttons slot="end">
				<ion-button
					data-translate="close"
					class="button-close"
					@click="dismiss()"
				>
					<ion-icon
						slot="start"
						:icon="closeOutline"
					>
					</ion-icon>
					{{ labels.close }}
				</ion-button>
			</ion-buttons>

		</ion-toolbar>
	</ion-header>
	<ion-content class="animate__animated animate__fadeIn">

		<ion-toolbar
			color="dark"
			mode="md"
			class="ion-text-center ion-text-uppercase"
		>
			<ion-title data-translate="close">How to get a location</ion-title>
		</ion-toolbar>

		<ion-card class="ion-margin">
			<ion-card-content class="ion-text-center">
				<h2>Type in any address and click &nbsp;</h2>
				<ion-button
					data-translate="update_location"
					size="small"
					color="secondary"
					slot="end"
				>
					<ion-icon :icon="locate"></ion-icon>
					&nbsp;
					{{ labels.update_location }}
				</ion-button>
			</ion-card-content>
		</ion-card>
		<ion-card class="ion-margin">
			<ion-card-content class="ion-text-center">
				<h2>Type in a latitude and longitude value and click &nbsp;</h2>
				<ion-button
					data-translate="update_location"
					size="small"
					color="secondary"
					slot="end"
				>
					<ion-icon :icon="locate"></ion-icon>
					&nbsp;
					{{ labels.update_location }}
				</ion-button>
			</ion-card-content>
		</ion-card>
		<ion-card class="ion-margin">
			<ion-card-content class="ion-text-center">
				<h2>Click the target icon pon the map to locate your current position</h2>
				<img
					class="locate-me-icon"
					alt="target"
					src="@/leaflet/images/locate-me@2x.png"
				/>

			</ion-card-content>
		</ion-card>
		<ion-card class="ion-margin">
			<ion-card-content class="ion-text-center">
				<h2>Drag the marker anywhere you want </h2>
				<img
					width="20"
					class="marker-icon"
					alt="target"
					src="@/leaflet/images/marker-icon@2x.png"
				/>
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

export default {
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({});

		const methods = {
			dismiss() {
				modalController.dismiss();
			}
		};

		const computedScope = {};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			closeOutline,
			locate
		};
	}
};
</script>

<style lang="scss" scoped></style>