<template>
	<ion-header class="ion-no-border">
		<ion-toolbar color="primary">
			<ion-buttons slot="start">
				<ion-button class="button-close"
							@click="dismiss()">
					<ion-icon slot="start"
							  :icon="closeOutline">
					</ion-icon>
					{{ labels.close }}
				</ion-button>
			</ion-buttons>
		</ion-toolbar>
	</ion-header>
</template>

<script>
import { closeOutline } from 'ionicons/icons';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
export default {
	emit: ['on-dismiss'],
	setup (props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const methods = {
			dismiss () {
				context.emit('on-dismiss');
			}
		};

		return {
			labels,
			...methods,
			//icons
			closeOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>