<template>
	<ion-page :id="id">
		<ion-header class="ion-no-border">
			<ion-toolbar v-if=showBetaToolbarAndroid
						 color="warning"
						 class="beta-toolbar">
				<ion-title slot="start">Beta</ion-title>
				<ion-buttons slot="end">
					<ion-button size="small"
								@click="reportBug()">
						Report a bug&nbsp;
						<ion-icon :icon="chatbubbleEllipses"></ion-icon>
					</ion-button>
				</ion-buttons>

			</ion-toolbar>
			<ion-toolbar>
				<ion-buttons slot="start">
					<slot name="actions-start"></slot>
				</ion-buttons>
				<ion-title class="project-header"
						   :class="isPWA ? 'pwa' : 'ion-text-center'"
						   v-html="title"
						   @click="exitApp($event)"></ion-title>
				<ion-buttons slot="end">
					<slot name="actions-end"></slot>
				</ion-buttons>
			</ion-toolbar>
			<ion-toolbar v-if="showBetaToolbariOS"
						 color="warning"
						 class="beta-toolbar">
				<ion-title slot="start">Beta</ion-title>
				<ion-buttons slot="end">
					<ion-button size="small"
								@click="reportBug()">
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
import { useRootStore } from '@/stores/root-store';
import { useRoute } from 'vue-router';
import { chatbubbleEllipses } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';

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
	emits: ['exit-app'],
	setup (props, context) {
		const rootStore = useRootStore();
		const route = useRoute();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const methods = {
			async reportBug () {
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
				}
				window.open(PARAMETERS.COMMUNITY_SUPPORT_URL, '_system', 'location=yes');
			},
			//emit event to exit app and go back to dataviewer
			// PWA in production only
			exitApp (e) {
				const allowedRoutes = [
					PARAMETERS.ROUTES.NOT_FOUND,
					PARAMETERS.ROUTES.ENTRIES_ADD,
					PARAMETERS.ROUTES.ENTRIES_EDIT,
					PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				];
				console.log('should exit app...');
				if (rootStore.isPWA && process.env.NODE_ENV === 'production') {
					//only the project logo is clickable
					if (e.target.className === 'project-logo' && e.target.localName === 'img') {
						//emit only on PWA routes
						if (allowedRoutes.includes(route.name)) {
							context.emit('exit-app');
						}
					}
				}
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
			chatbubbleEllipses,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped></style>