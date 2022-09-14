<template>
	<ion-header>
		<ion-toolbar>
			<ion-buttons slot="start">
				<ion-button @click="dismiss()">
					<ion-icon
						slot="icon-only"
						:icon="closeOutline"
					>
					</ion-icon>
				</ion-button>
			</ion-buttons>
		</ion-toolbar>
	</ion-header>
	<ion-content>
		<StreamBarcodeReader
			@decode="barcodeDecode()"
			@loaded="barcodeReaderLoaded()"
		></StreamBarcodeReader>
	</ion-content>
	<ion-footer>
	</ion-footer>
</template>

<script>
import { modalController } from '@ionic/vue';
import { StreamBarcodeReader } from 'vue-barcode-reader';
import { reactive } from '@vue/reactivity';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { PARAMETERS } from '@/config';

export default {
	components: { StreamBarcodeReader },
	props: {},
	setup(props) {
		const state = reactive({
			result: ''
		});
		const methods = {
			dismiss() {
				modalController.dismiss(state.result);
			},
			barcodeDecode(result) {
				console.log(result);
				state.result = result;
			},
			barcodeReaderLoaded() {
				services.notificationService.hideProgressDialog(PARAMETERS.DELAY_MEDIUM);
			}
		};
		return {
			...props,
			...icons,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
ion-content {
	--background: transparent;
}
ion-header {
	ion-toolbar {
		--background: transparent;
		ion-button,
		ion-icon {
			color: #333;
		}
	}
}
.button-container {
	display: none !important;
}
</style>