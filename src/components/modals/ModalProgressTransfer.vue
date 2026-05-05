<template>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-title class="ion-text-center"
					   color="dark">{{ header }}
			</ion-title>
			<ion-buttons
				v-if="showCloseButton"
				slot="end"
			>
				<ion-button @click="closeModal()">
					<ion-icon
						slot="icon-only"
						:icon="closeOutline"
					></ion-icon>
				</ion-button>
			</ion-buttons>
		</ion-toolbar>
	</ion-header>
	<ion-content class="ion-text-center">
		<ion-spinner class="spinner-transfer"
					 name="crescent"></ion-spinner>
		<div v-if="total > 0"
			 class="progress-transfer animate__animated animate__fadeIn">
			<ion-progress-bar color="primary"
							  :value="progress"></ion-progress-bar>
			<strong>
				<p>{{ done }}/{{ total }}</p>
			</strong>
		</div>
	</ion-content>
</template>

<script>
import { computed } from '@vue/reactivity';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { closeOutline } from 'ionicons/icons';
import { modalController } from '@ionic/vue';
import { notificationService } from '@/services/notification-service';

export default {
	props: {
		header: {
			type: String,
			required: true
		},
		showCloseButton: {
			type: Boolean,
			default: false
		},
		onClose: {
			type: Function,
			default: null
		}
	},
	setup (props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const computedScope = {
			progress: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.done / progress.total;
			}),
			total: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.total;
			}),
			done: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.done;
			}),
			header: props.header,
			showCloseButton: props.showCloseButton
		};

		const methods = {
			async closeModal() {
				const confirmed = await notificationService.confirmSingle(labels.are_you_sure);

				if (confirmed) {
					if (props.onClose) {
						props.onClose();
					}
					await modalController.dismiss(null, 'cancel');
				}
			}
		};
		return {
			labels,
			...computedScope,
			...methods,
			closeOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>
