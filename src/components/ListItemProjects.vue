<template>
	<ion-item
		v-for="(project, index) in projects"
		:key="project.ref"
		@click="handleSelectedProject(project)"
	>
		<ion-avatar slot="start">
			<ion-spinner
				class="spinner"
				v-show="!state.imagesLoaded.includes(index)"
				name="crescent"
			></ion-spinner>
			<ion-img
				class="animate__animated animate__fadeIn"
				:src="getProjectLogo(project)"
				@ionImgDidLoad="onImgLoaded(index)"
			></ion-img>
		</ion-avatar>

		<ion-label>
			<p>{{project.name}}</p>
		</ion-label>
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
		const privateLogo = PARAMETERS.PROJECT_LOGO_PRIVATE;
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
			getProjectLogo(project) {
				let logo = '';
				//when searching, do not display logo for private projects
				if (props.page === 'add-project') {
					if (project.access === 'private') {
						logo = privateLogo;
					}
					if (project.access === 'public') {
						logo = project.logo;
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

<style lang="scss" scoped>
.spinner {
	position: absolute;
	top: 15px;
	left: 22px;
	// color: var(--ion-color-light-shade);
}
</style>