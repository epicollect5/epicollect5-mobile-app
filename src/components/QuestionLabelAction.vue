<template>
	<ion-grid class="question-label-grid">
		<ion-row>
			<ion-col
				size-xs="10"
				size-sm="11"
				size-md="11"
				size-lg="11"
				size-xl="11"
			>
				<div class="">{{questionText}}</div>
			</ion-col>
			<ion-col
				size-xs="2"
				size-sm="1"
				size-md="1"
				size-lg="1"
				size-xl="1"
			>
				<div
					class="question-label-button ion-activatable ripple-parent ion-text-center"
					@click="onLabelButtonClick($event)"
				>
					<ion-icon
						v-if="disabled"
						class="disabled"
						:icon="actionIcon"
					></ion-icon>
					<ion-icon
						v-else
						:icon="actionIcon"
					></ion-icon>
					<ion-ripple-effect
						class="question-label-button-ripple"
						type="unbounded"
					></ion-ripple-effect>
				</div>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
import * as icons from 'ionicons/icons';
import { computed } from '@vue/reactivity';

export default {
	props: {
		questionText: {
			type: String,
			required: true
		},
		action: {
			type: String,
			required: true
		},
		disabled: {
			type: Boolean,
			required: true
		}
	},
	emit: ['on-label-button-click'],
	setup(props, context) {
		const methods = {
			onLabelButtonClick(e) {
				context.emit('on-label-button-click', e);
			}
		};

		const computedScope = {
			actionIcon: computed(() => {
				const { action } = props;
				switch (action) {
					case 'media':
						return icons.ellipsisVertical;
					case 'search':
						return icons.search;
					case 'filter':
						return icons.filter;
					case 'help':
						return icons.helpCircle;
					default:
						return icons.filter;
				}
			})
		};

		return {
			...icons,
			...props,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
</style>