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
			<ion-title class="project-header ion-text-center"
					   v-html="getProjectNameMarkup()"></ion-title>
			<ion-buttons slot="end">
				<ion-button class="button-open"
							@click="goToProjectHomePage()">
					<ion-icon slot="end"
							  :icon="open">
					</ion-icon>
				</ion-button>
			</ion-buttons>

		</ion-toolbar>
	</ion-header>
	<ion-content class="animate__animated animate__fadeIn">

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{ labels.project_info }}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{ projectName }}
				</h2>
			</ion-card-content>
		</ion-card>

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{ labels.small_description }}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{ projectSmallDescription }}
				</h2>
			</ion-card-content>
		</ion-card>

		<ion-card>
			<ion-card-header class="settings-label">
				<ion-card-title class="ion-text-center ion-text-uppercase">
					{{ labels.description }}
				</ion-card-title>
			</ion-card-header>
			<ion-card-content>
				<h2 class="ion-padding-top">
					{{ projectDescription }}
				</h2>
			</ion-card-content>
		</ion-card>
	</ion-content>
</template>

<script>
import { open, closeOutline } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';

export default {
	setup (props) {
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
			dismiss () {
				modalController.dismiss();
			},
			getProjectNameMarkup () {
				return utilsService.getProjectNameMarkup(true);
			},
			async goToProjectHomePage () {
				const slug = projectModel.getSlug();
				const homepage = PARAMETERS.DEFAULT_SERVER_URL + PARAMETERS.API.ROUTES.PROJECT + slug;

				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
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
			...methods,
			//icons
			open,
			closeOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>