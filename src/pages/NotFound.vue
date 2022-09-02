<template>
	<base-layout title="">
		<template #actions-start>
		</template>

		<template #content>
			<ion-toolbar
				color="danger"
				mode="ios"
				class="animate__animated animate__fadeIn"
			>
				<div class="center-item-content-wrapper">
					<ion-label class="ion-text-center ion-text-uppercase ">
						404
					</ion-label>
				</div>
			</ion-toolbar>

			<ion-card>
				<ion-card-content class="ion-text-center ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-center"
					>
						<ion-label>{{labels.no_projects_found}}</ion-label>
					</ion-item>
				</ion-card-content>
			</ion-card>

		</template>
	</base-layout>
</template>

<script>
import * as icons from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import * as services from '@/services';
import { useBackButton } from '@ionic/vue';

export default {
	components: {},
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		onMounted(() => {
			console.log('Component NotFound is mounted!');
		});

		return {
			labels,
			...icons
		};
	}
};
</script>

<style lang="scss" scoped>
</style>