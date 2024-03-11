<template>
	<base-layout title="">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #subheader>
			<ion-toolbar
				color="dark"
				mode="md"
			>
				<ion-buttons slot="start">
					<ion-button @click="goToProjectsList()">
						<ion-icon
							slot="start"
							:icon="chevronBackOutline"
						>
						</ion-icon>
						{{ labels.projects }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</template>

		<template #content>
			<ion-searchbar
				animated
				debounce="500"
				:placeholder="labels.search_for_project"
				@ionInput="fetchProjects"
			></ion-searchbar>

			<div
				v-if="state.isFetching"
				class="ion-text-center ion-margin"
			>
				<ion-spinner
					class="spinner-fetch-projects "
					name="crescent"
				></ion-spinner>
			</div>

			<div
				v-else
				class="animate__animated animate__fadeIn"
			>
				<div
					v-show="!state.isFetching && state.projects.length > 0"
					class="projects-list"
				>
					<ion-list lines="none">
						<list-item-projects
							:projects="state.projects"
							page="add-project"
							@project-selected="onProjectSelected"
						></list-item-projects>
					</ion-list>
				</div>
				<div v-show="!state.isFetching && state.projects.length === 0 && state.searchTerm !== ''">
					<ion-card class="ion-text-center animate__animated animate__fadeIn">
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
import { chevronBackOutline } from 'ionicons/icons';
import { reactive, readonly } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { addProject } from '@/use/add-project';
import { fetchServerProjects } from '@/use/fetch-server-projects';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { useBackButton } from '@ionic/vue';

export default {
	components: {
		ListItemProjects
	},
	setup() {
		const rootStore = useRootStore();
		const router = useRouter();
		const state = reactive({
			isFetching: false,
			projects: [],
			searchTerm: ''
		});

		const methods = {
			//redirect to projects list
			goToProjectsList() {
				router.replace({
					name: PARAMETERS.ROUTES.PROJECTS
				});
			},
			onProjectSelected(project) {
				addProject(project, router);
			},
			async fetchProjects(e) {
				state.searchTerm = e.target.value.trimStart();

				//search string too short, bail out
				if (state.searchTerm.length < 3) {
					return false;
				}
				//no internet connection, bail out
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(
						STRINGS[rootStore.language].status_codes.ec5_135 + '!',
						STRINGS[rootStore.language].labels.error
					);
					return false;
				}

				state.isFetching = true;
				fetchServerProjects(readonly(state.searchTerm)).then(
					(projects) => {
						console.log(projects);
						if (projects.length > 0) {
							state.projects = projects;
						} else {
							state.projects = [];
						}
						state.isFetching = false;
					},
					(error) => {
						errorsService.handleWebError(error);
						// No projects?
						try {
							if (error?.data === null) {
								// Show no projects found message
								state.projects = [];
							}
						} catch (error) {
							console.log(error);
							state.projects = [];
						}
						state.isFetching = false;
					}
				);
			}
		};

		//back to projects list with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isFetching) {
				methods.goToProjectsList();
			}
		});

		return {
			labels: STRINGS[rootStore.language].labels,
			...methods,
			state,
			chevronBackOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>