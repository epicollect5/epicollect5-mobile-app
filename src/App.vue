<template>
	<ion-app>
		<left-drawer></left-drawer>
		<right-drawer></right-drawer>
		<ion-router-outlet id="main" />
	</ion-app>
</template>

<script>
import { IonApp, IonRouterOutlet } from '@ionic/vue';

export default {
	name: 'App',
	components: {
		IonApp,
		IonRouterOutlet
	}
};
</script>