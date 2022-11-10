<template>
	<ion-app>
		<left-drawer v-if="needsDrawers"></left-drawer>
		<right-drawer v-if="needsDrawers"></right-drawer>
		<ion-router-outlet id="main" />
	</ion-app>
</template>

<script>
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { useRootStore } from '@/stores/root-store';
import { computed } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { onMounted } from 'vue';

export default {
	name: 'App',
	components: {
		IonApp,
		IonRouterOutlet
	},
	setup() {
		const rootStore = useRootStore();
		const computedScope = {
			needsDrawers: computed(() => {
				return rootStore.device.platform !== PARAMETERS.PWA;
			})
		};

		onMounted(async () => {
			console.log('App mounted');
			if (rootStore.isPWA && process.env.NODE_ENV === 'production') {
				//remove loader div (laravel servers only)
				document.querySelector('#loader.loader-placeholder').remove();
			}
		});

		return {
			...computedScope
		};
	}
};
</script>