<template>
	<ion-grid>
		<ion-row>
			<ion-col>
				<ion-label class="ion-text-uppercase"><strong>{{labels.latitude}} </strong></ion-label>
			</ion-col>
			<ion-col>
				<span v-if="item.answer.latitude === ''">
					{{labels.not_located_yet}}
				</span>
				<span v-else>
					{{latitude}}
				</span>
			</ion-col>
		</ion-row>
		<ion-row>
			<ion-col>
				<ion-label class="ion-text-uppercase"><strong>{{labels.longitude}} </strong></ion-label>
			</ion-col>
			<ion-col>
				<span v-if="item.answer.longitude === ''">
					{{labels.not_located_yet}}
				</span>
				<span v-else>
					{{longitude}}
				</span>
			</ion-col>
		</ion-row>
		<ion-row>
			<ion-col>
				<ion-label class="ion-text-uppercase"><strong>{{labels.accuracy}} </strong></ion-label>
			</ion-col>
			<ion-col>
				<span v-if="item.answer.accuracy === ''">
					{{labels.not_located_yet}}
				</span>
				<span v-else>
					{{item.answer.accuracy}}
				</span>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { computed } from '@vue/reactivity';

export default {
	props: {
		item: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const computedScope = {
			latitude: computed(() => {
				return parseFloat(props.item.answer.latitude).toFixed(6);
			}),
			longitude: computed(() => {
				return parseFloat(props.item.answer.longitude).toFixed(6);
			})
		};

		return {
			labels,
			...props,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
</style>