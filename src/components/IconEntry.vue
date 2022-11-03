<template>
	<ion-icon
		:icon="desktopOutline"
		v-if="entry.is_remote === 1"
		class="entry-not-synced"
	>
	</ion-icon>
	<ion-icon
		slot="start"
		:icon="cloudOutline"
		v-if="entry.synced === 0"
		class="entry-not-synced"
	></ion-icon>

	<ion-icon
		:icon="cloudDone"
		v-if="entry.synced === 1 "
		class="entry-synced"
	>
	</ion-icon>
	<ion-icon
		:icon="cloud"
		v-if="entry.synced === -1 "
		class="entry-sync-error"
	></ion-icon>

	<ion-icon
		:icon="removeCircle"
		class="entry-incomplete"
		v-if="entry.synced === 2 "
	></ion-icon>

	<ion-icon
		:icon="cloudOutline"
		v-if="entry.synced === 3 "
		class="entry-not-synced"
	></ion-icon>
	<ion-icon
		:icon="bug"
		class="entry-sync-error"
		v-if="entry.hasMediaError"
	></ion-icon>
</template>

<script>
import { bug, cloudOutline, removeCircle, cloud, cloudDone, desktopOutline } from 'ionicons/icons';

export default {
	props: {
		entry: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		return {
			...props,
			//icons
			bug,
			cloudOutline,
			removeCircle,
			cloud,
			cloudDone,
			desktopOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>