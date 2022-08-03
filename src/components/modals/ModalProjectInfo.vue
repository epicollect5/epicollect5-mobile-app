<template>
	<ion-header>
		<ion-toolbar color="primary">
			<ion-buttons slot="start">
				<ion-button
					class="button-close"
					@click="dismiss()"
				>
					<ion-icon
						slot="start"
						:icon="closeOutline"
					>
					</ion-icon>
					{{labels.close}}
				</ion-button>
			</ion-buttons>
			<ion-title
				class="project-header ion-text-center"
				v-html="getProjectLogoMarkup()"
			></ion-title>
			<ion-buttons slot="end">
				<ion-button
					class="button-open"
					@click="goToProjectHomePage()"
				>
					<ion-icon
						slot="end"
						:icon="open"
					>
					</ion-icon>
				</ion-button>
			</ion-buttons>

		</ion-toolbar>
	</ion-header>
	<ion-content class="animate__animated animate__fadeIn">

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{labels.project_info}}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{projectName}}
				</h2>
			</ion-card-content>
		</ion-card>

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{labels.small_description}}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{projectSmallDescription}}
				</h2>
			</ion-card-content>
		</ion-card>

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{labels.description}}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{projectDescription}}
				</h2>
			</ion-card-content>
		</ion-card>
	</ion-content>

</template>

<script>
import * as icons from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { modalController } from '@ionic/vue';
import * as services from '@/services';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';

export default {
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			isFetching: false,
			noHits: false, //todo: why not checkig if projects[] is empty?
			hits: [],
			picks: []
		});

		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			getProjectLogoMarkup() {
				return services.utilsService.getProjectLogoMarkup();
			},
			async goToProjectHomePage() {
				const slug = projectModel.getSlug();
				const homepage = PARAMETERS.DEFAULT_SERVER_URL + PARAMETERS.API.ROUTES.PROJECT + slug;

				const hasInternetConnection = await services.utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					services.notificationService.showAlert(
						STRINGS[language].status_codes.ec5_135 + '!',
						labels.error
					);
					state.isFetching = false;
					return;
				}
				window.open(homepage, '_system', 'location=yes');
			}
		};

		const computedScope = {
			projectName: projectModel.getProjectName(),
			projectSmallDescription: projectModel.getSmallDescription(),
			projectDescription: projectModel.getDescription()
		};

		return {
			labels,
			state,
			...computedScope,
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
</style>