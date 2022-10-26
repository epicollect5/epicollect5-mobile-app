<template>
	<ion-page :id="id">
		<ion-header>
			<ion-toolbar
				v-if=showBetaToolbarAndroid
				color="warning"
				class="beta-toolbar"
			>
				<ion-title slot="start">Beta</ion-title>
				<ion-buttons slot="end">
					<ion-button
						size="small"
						@click="reportBug()"
					>
						Report a bug&nbsp;
						<ion-icon :icon="chatbubbleEllipses"></ion-icon>
					</ion-button>
				</ion-buttons>

			</ion-toolbar>
			<ion-toolbar>
				<ion-buttons slot="start">
					<slot name="actions-start"></slot>
				</ion-buttons>
				<ion-title
					class="project-header"
					:class="isPWA ? 'pwa' : 'ion-text-center'"
					v-html="title"
				></ion-title>
				<ion-buttons slot="end">
					<slot name="actions-end"></slot>
				</ion-buttons>
			</ion-toolbar>
			<ion-toolbar
				v-if="showBetaToolbariOS"
				color="warning"
				class="beta-toolbar"
			>
				<ion-title slot="start">Beta</ion-title>
				<ion-buttons slot="end">
					<ion-button
						size="small"
						@click="reportBug()"
					>
						Report a bug&nbsp;
						<ion-icon :icon="chatbubbleEllipses"></ion-icon>
					</ion-button>
				</ion-buttons>

			</ion-toolbar>
			<slot name="subheader"></slot>
		</ion-header>
		<ion-content>
			<slot name="content"></slot>
		</ion-content>
	</ion-page>
</template>

<script>
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import * as services from '@/services';

import { useRootStore } from '@/stores/root-store';
import * as icons from 'ionicons/icons';
import { computed } from '@vue/reactivity';

export default {
	props: {
		title: {
			type: String,
			required: true
		},
		id: {
			type: String
		}
	},
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const methods = {
			async reportBug() {
				const hasInternetConnection = await services.utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					services.notificationService.showAlert(
						STRINGS[language].status_codes.ec5_135 + '!',
						labels.error
					);
				}
				window.open(PARAMETERS.COMMUNITY_SUPPORT_URL, '_system', 'location=yes');
			}
		};

		const computedScope = {
			showBetaToolbarAndroid: computed(() => {
				if (rootStore.device.platform === PARAMETERS.ANDROID) {
					return rootStore.app.id.includes('beta');
				}
			}),
			showBetaToolbariOS: computed(() => {
				if (rootStore.device.platform === PARAMETERS.IOS) {
					return rootStore.app.id.includes('beta');
				}
			}),
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		return {
			...icons,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
</style>