<template>
	<ion-item-divider
		sticky
		class="list-entries-filters"
	>
		<ion-button
			v-show="countWithFilters !== countNoFilters"
			class="filters-clear"
			fill="clear"
			color="primary"
			@click="filtersClear()"
		>{{labels.clear_filters}}
			<ion-icon :icon="close"></ion-icon>
		</ion-button>
		<div
			v-if="countWithFilters !== countNoFilters"
			slot="end"
			class="filters-count ion-text-uppercase ion-padding-end"
		>
			{{labels.entries}} <span> {{countWithFilters}}/{{countNoFilters}} </span>
		</div>
		<div
			v-else
			slot="end"
			class="filters-count ion-text-uppercase ion-padding-end"
		>{{labels.entries}} <span> {{countNoFilters}} </span>
		</div>
	</ion-item-divider>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { close } from 'ionicons/icons';

export default {
	emit: ['filters-clear'],
	props: {
		countNoFilters: {
			type: Number,
			required: true
		},
		countWithFilters: {
			type: Number,
			required: true
		}
	},
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const methods = {
			filtersClear() {
				context.emit('filters-clear');
			}
		};

		return {
			labels,
			...props,
			...methods,
			//icons
			close
		};
	}
};
</script>

<style lang="scss" scoped>
</style>