<template>
	<ion-header class="ion-no-border">
		<ion-toolbar>
			<ion-title class="ion-text-center"
					   color="dark">{{ header }}
			</ion-title>
		</ion-toolbar>
	</ion-header>
	<ion-content class="ion-text-center">
		<ion-spinner
        class="spinner-encoding"
        name="crescent">
    </ion-spinner>
		<div
			 class="progress-encoding animate__animated animate__fadeIn"
    >
			<ion-progress-bar
          color="primary"
          :value="progress"
      >
      </ion-progress-bar>
      <ion-item lines="none">
          <ion-label class="ion-text-center">
            <strong>{{ percentageDisplay }}</strong>
          </ion-label>
        </ion-item>
		</div>
	</ion-content>
</template>

<script>
import { computed } from '@vue/reactivity';
import { useRootStore } from '@/stores/root-store';

export default {
	props: {
		header: {
			type: String,
			required: true
		}
	},
	setup (props) {
		const rootStore = useRootStore();

		const computedScope = {
			progress: computed(() => {
				const progress = rootStore.progressEncoding;
				return progress.done;
			}),
      percentageDisplay: computed(() => {
        const progress = rootStore.progressEncoding;
        return Math.round((progress.done) * 100) + '%';
      }),
			header: props.header
		};
		return {
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped></style>
