<template>
	<base-layout
		title=""
		:class="state.zoom"
		v-show="state.show"
	>
		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<ion-button
				class="ion-text-nowrap"
				fill="clear"
				@click="addProject()"
			>
				<ion-icon
					slot="start"
					:icon="add"
				></ion-icon>
				{{ labels.add_project }}
			</ion-button>
		</template>

		<template #subheader>
			<ion-toolbar color="dark">
				<ion-title
					size="small"
					class="ion-text-center ion-text-uppercase"
				>{{ labels.projects }}</ion-title>
			</ion-toolbar>
		</template>

		<template #content>
			<ion-spinner
				v-if="state.isFetching"
				class="loader"
				name="crescent"
			></ion-spinner>

			<div v-else>
				<div
					v-show="!state.isFetching && state.projects.length > 0"
					class="projects-list"
				>
					<ion-list lines="none">
						<list-item-projects
							:projects="state.projects"
							page="projects"
							@project-selected="onProjectSelected"
						></list-item-projects>
					</ion-list>
				</div>
				<div v-show="!state.isFetching && state.projects.length === 0">
					<ion-card class="ion-text-center">
						<ion-card-header>
							<ion-card-title>{{ labels.no_projects_found }}</ion-card-title>
						</ion-card-header>
					</ion-card>
				</div>
			</div>
		</template>
	</base-layout>
</template>

<script>
import ListItemProjects from '@/components/ListItemProjects';
import { add } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { onMounted, onActivated, watch, onRenderTriggered } from 'vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { fetchLocalProjects } from '@/use/fetch-local-projects';
import { useRouter, useRoute } from 'vue-router';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { Plugins } from '@capacitor/core';
const { App } = Plugins;
import { onIonViewWillEnter, onIonViewWillLeave, useBackButton } from '@ionic/vue';

export default {
	components: {
		ListItemProjects
	},
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const route = useRoute();
		const state = reactive({
			isFetching: true,
			show: true,
			projects: []
		});

		//get local projects async
		fetchLocalProjects().then((projects) => {
			state.projects = projects;
			state.isFetching = false;
			notificationService.hideProgressDialog();
		});

		const methods = {
			addProject() {
				console.log('should open add project page');
				router.replace({
					name: PARAMETERS.ROUTES.PROJECTS_ADD
				});
			},

			async onProjectSelected(project) {
				//set route parameters
				rootStore.routeParams = {
					projectRef: project.ref,
					formRef: '',
					status: null
				};
				//go to entries page
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES
				});
			}
		};

		onMounted(async () => {
			console.log('Component Projects is mounted!');
			//add zoom level class to set UI zoom level
			const zoomLevel = parseInt(rootStore.selectedTextSize);
			document.body.classList.add('zoom-' + zoomLevel);

			console.log(window.RandExp);
		});

		//exit app when pressing back button (Android)
		useBackButton(10, async () => {
			const confirmed = await notificationService.confirmSingle(
				labels.are_you_sure,
				labels.close + ' App'
			);
			if (confirmed) {
				App.exitApp();
			}
		});

		onActivated(() => {
			console.log('Component Projects is activated!');
		});

		onRenderTriggered(() => {
			console.log('Component Projects is rendered!');
		});

		onIonViewWillEnter(() => {
			state.show = true;
		});

		onIonViewWillLeave(() => {
			state.show = false;
		});

		//re-fetch projects list when needed (after add or delete)
		watch(
			() => [
				{
					refresh: route.params.refresh
				}
			],
			(changes) => {
				if (changes[0].refresh) {
					state.isFetching = true;
					window.setTimeout(function () {
						//get local projects async
						fetchLocalProjects().then((projects) => {
							state.projects = projects;
							state.isFetching = false;

							notificationService.hideProgressDialog();
						});
					}, PARAMETERS.DELAY_LONG);
				}
			}
		);

		return {
			labels,

			...methods,
			state,
			//icons
			add
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>