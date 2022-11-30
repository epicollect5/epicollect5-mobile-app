<template>
	<ion-toolbar
		color="dark"
		mode="md"
	>
		<ion-buttons slot="start">
			<ion-button
				:disabled="props.disablePrevious"
				@click="prev()"
			>
				<ion-icon
					slot="start"
					:icon="chevronBackOutline"
				>
				</ion-icon>
				{{labels.prev}}
			</ion-button>
		</ion-buttons>

		<div>
			<div class="question-progress-bar">
				<div :style="{width: props.progressBarWidth }">
				</div>
			</div>
		</div>

		<ion-buttons slot="end">
			<ion-button
				:disabled="props.disableNext"
				@click="next()"
			>
				{{labels.next}}
				<ion-icon
					slot="end"
					:icon="chevronForwardOutline"
				>
				</ion-icon>
			</ion-button>
		</ion-buttons>

	</ion-toolbar>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { chevronForwardOutline, chevronBackOutline } from 'ionicons/icons';

export default {
	emit: ['prev-clicked', 'next-clicked'],
	props: {
		disablePrevious: {
			type: Boolean,
			required: true
		},
		disableNext: {
			type: Boolean,
			required: true
		},
		progressBarWidth: {
			type: [Number, String],
			required: true
		}
	},
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const methods = {
			prev() {
				context.emit('prev-clicked');
			},
			next() {
				context.emit('next-clicked');
			}
		};

		return {
			labels,
			props,
			...methods,
			//icons
			chevronForwardOutline,
			chevronBackOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>