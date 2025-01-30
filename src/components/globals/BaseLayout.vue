<template>
	<ion-page :id="id">
		<ion-header class="ion-no-border">
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
	emits: ['exit-app'],
	setup (props, context) {
		const rootStore = useRootStore();
		const route = useRoute();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const methods = {
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
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		return {
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped></style>
