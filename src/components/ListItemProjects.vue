<template>
	<ion-item
		v-for="(project, index) in projects"
		:key="project.ref"
		@click="handleSelectedProject(project)"
	>
		<ion-avatar slot="start">
			<ion-spinner
				class="spinner"
				v-show="!state.imagesLoaded.includes(index) && !showLockIcon(project)"
				name="crescent"
			></ion-spinner>
			<svg
				v-if="showLockIcon(project)"
				class="project-lock-icon animate__animated animate__fadeIn"
				version="1.1"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 512 512"
				aria-hidden="true"
			>
				<path
					d="M368 192h-16v-80a96 96 0 1 0-192 0v80h-16a64.07 64.07 0 0 0-64 64v176a64.07 64.07 0 0 0 64 64h224a64.07 64.07 0 0 0 64-64V256a64.07 64.07 0 0 0-64-64m-48 0H192v-80a64 64 0 1 1 128 0Z"
					fill="currentColor"
				></path>
			</svg>
			<img
				v-else
				class="animate__animated animate__fadeIn"
				:src="getProjectLogo(project)"
				@load="onImgLoaded(index)"
			>
		</ion-avatar>

		<ion-label class="ion-text-nowrap">{{ project.name }}</ion-label>
	</ion-item>
</template>

<script>
import { reactive } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { computed, readonly } from '@vue/reactivity';
export default {
	props: {
		projects: {
			type: Array,
			required: true
		},
		page: {
			type: String,
			required: true
		}
	},
	emits: ['project-selected'],
	setup(props, context) {
		const placeholderLogo = PARAMETERS.PROJECT_LOGO_PLACEHOLDER;
		const projects = readonly(props.projects);

		const state = reactive({
			imagesLoaded: []
		});

		const methods = {
			//keep track of which images are loaded
			onImgLoaded(index) {
				state.imagesLoaded.push(index);
			},
			handleSelectedProject(project) {
				context.emit('project-selected', project);
			},
			//when searching, private projects show a theme-aware lock icon
			//instead of a logo
			showLockIcon(project) {
				return props.page === 'add-project' && project.access === 'private';
			},
			getProjectLogo(project) {
				let logo = '';
				//when searching, private projects use the lock icon, so only
				//public ones resolve a logo here
				if (props.page === 'add-project') {
					if (project.access === 'public') {
						// Public projects: logo carries the base64 data URI
						// embedded in the search payload. Fall back to the
						// generic placeholder if the field is missing.
						logo = project.logo || placeholderLogo;
					}
				}
				if (props.page === 'projects') {
					logo = project.logo;
				}
				return logo;
			}
		};

		const computedScope = {
			projects: computed(() => {
				//return unique projects array based on "ref" key
				//this is to avoid duplicates on slow devices (angular had the same issue)
				return [...new Map(projects.map((project) => [project['ref'], project])).values()];
			})
		};

		return {
			props,
			state,
			...methods,
			...computedScope
		};
	}
};
</script>

<style src="@/theme/components/lists/ListItemProjects.scss" lang="scss"></style>
