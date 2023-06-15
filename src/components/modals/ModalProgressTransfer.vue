<template>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-title class="ion-text-center"
					   color="dark">{{ header }}
			</ion-title>
		</ion-toolbar>
	</ion-header>
	<ion-content class="ion-text-center">
		<ion-spinner class="spinner-transfer"
					 name="crescent"></ion-spinner>
		<div v-if="total > 0"
			 class="progress-transfer animate__animated animate__fadeIn">
			<ion-progress-bar color="primary"
							  :value="progress"></ion-progress-bar>
			<strong>
				<p>{{ done }}/{{ total }}</p>
			</strong>
		</div>
	</ion-content>
</template>

<script>
import { computed } from '@vue/reactivity';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

export default {
	props: {
		header: {
			type: String,
			required: true
		}
	},
	setup (props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const computedScope = {
			progress: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.done / progress.total;
			}),
			total: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.total;
			}),
			done: computed(() => {
				const progress = rootStore.progressTransfer;
				return progress.done;
			}),
			header: props.header
		};
		return {
			labels,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped></style>