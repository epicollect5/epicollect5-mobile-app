<template>
	<ion-toolbar
		v-if="!isFetching"
		color="light"
		class="form-name animate__animated animate__fadeIn"
	>
		<!-- Adding a hidden ion-buttons here, if it is removed, it breaks the ripple button on the end slot -->
		<!-- i.e is not a circle and is not centered. Bug with Ionic 5-->
		<ion-buttons
			v-show="false"
			slot="start"
		>
			<ion-button>
				<ion-icon :icon="star"></ion-icon>
			</ion-button>
		</ion-buttons>
		<!-- -------------------------------------------------------- -->
		<ion-buttons slot="end">
			<ion-button
				:disabled="countNoFilters === 0"
				@click="openModalEntriesFilter()"
			>
				<ion-icon
					slot="icon-only"
					:icon="filter"
				></ion-icon>
			</ion-button>
		</ion-buttons>

		<ion-title class="form-name-label">
			{{ parentEntryName }} {{ currentFormName }}
		</ion-title>
	</ion-toolbar>

</template>

<script>
import { star, filter } from 'ionicons/icons';
import { readonly } from '@vue/reactivity';
import ModalEntriesFilter from '@/components/modals/ModalEntriesFilter';
import { modalController } from '@ionic/vue';

export default {
	emit: ['filters-params'],
	props: {
		projectRef: {
			type: String,
			required: true
		},
		isFetching: {
			type: Boolean,
			required: true
		},
		parentEntryName: {
			type: String,
			required: true
		},
		currentFormName: {
			type: String,
			required: true
		},
		formRef: {
			type: String,
			required: true
		},
		parentEntryUuid: {
			type: String,
			required: true
		},
		countWithFilters: {
			type: Number,
			required: true
		},
		countNoFilters: {
			type: Number,
			required: true
		},
		filters: {
			type: Object,
			required: true
		}
	},
	setup(props, context) {
		const scope = {};

		const methods = {
			async openModalEntriesFilter() {
				const { projectRef, formRef, parentEntryUuid, countNoFilters } = readonly(props);

				const filters = { ...props.filters };
				const countWithFilters = props.countWithFilters;

				console.log('countNoFilters', countNoFilters);
				scope.ModalEntriesFilter = await modalController.create({
					cssClass: 'modal-entries-filter',
					component: ModalEntriesFilter,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						projectRef,
						formRef,
						parentEntryUuid,
						countWithFilters,
						countNoFilters,
						filters
					}
				});

				scope.ModalEntriesFilter.onWillDismiss().then((response) => {
					context.emit('filters-params', response.data);
				});
				return scope.ModalEntriesFilter.present();
			}
		};

		return {
			...props,
			...methods,
			//icons
			star,
			filter
		};
	}
};
</script>

<style lang="scss" scoped>
</style>