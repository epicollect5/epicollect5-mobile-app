<template>
	<ion-header class="ion-no-border">
		<ion-toolbar color="primary">
			<ion-buttons slot="start">
				<ion-button :disabled="state.isFetching"
							class="button-close"
							@click="dismiss()">
					<ion-icon slot="start"
							  :icon="closeOutline">
					</ion-icon>
					{{ labels.close }}
				</ion-button>
			</ion-buttons>
			<ion-buttons slot="end">
				<ion-button :disabled="state.isFetching"
							class="button-close"
							@click="resetFilters()">
					<ion-icon slot="start"
							  :icon="filter">
					</ion-icon>
					{{ labels.reset }}
				</ion-button>
			</ion-buttons>

		</ion-toolbar>
	</ion-header>
	<ion-content>
		<ion-item lines="none"
				  class="filter-by-title">
			<div class="center-item-content-wrapper half-padding">
				<ion-spinner v-if="state.isFetching"
							 name="crescent"
							 class="spinner-filter"></ion-spinner>
				<ion-button v-else
							color="secondary"
							size="default"
							expand="block"
							class="animate__animated animate__fadeIn"
							@click="dismiss()">{{ labels.show }} {{ state.count }} {{ labels.entries }}</ion-button>
			</div>
		</ion-item>

		<ion-item lines="none">
			<ion-searchbar animated
						   debounce="500"
						   :placeholder="labels.filter_by_title"
						   @ionInput="filterByTitle"
						   :value="state.searchbarInitialValue"></ion-searchbar>
		</ion-item>

		<ion-toolbar class="filter-by-date-from">
			<ion-title class="ion-text-end">
				<div>
					<ion-label>{{ labels.from }}</ion-label>
					<input type="date"
						   :min="state.filters.oldest"
						   :max="state.filters.newest"
						   v-model="state.filters.from"
						   @change="filterByDate()" />
				</div>
			</ion-title>
		</ion-toolbar>

		<ion-toolbar class="filter-by-date-to">
			<ion-title class="ion-text-end">
				<div>
					<ion-label>{{ labels.to }}</ion-label>
					<input type="date"
						   :min="state.filters.oldest"
						   :max="state.filters.newest"
						   v-model="state.filters.to"
						   @change="filterByDate()" />
				</div>
			</ion-title>
		</ion-toolbar>
		<div class="line-divider"></div>
		<ion-item lines="none"
				  class="filter-by-status">
			<ion-segment @ionChange="filterByStatus($event)"
						 color="tertiary"
						 :value="state.filters.status">
				<ion-segment-button :value="PARAMETERS.STATUS.ALL"
									layout="icon-bottom">
					<ion-icon :icon="cloudOutline"></ion-icon>
					<ion-label>{{ labels.all }}</ion-label>
				</ion-segment-button>
				<ion-segment-button :value="PARAMETERS.STATUS.INCOMPLETE"
									layout="icon-bottom">
					<ion-icon :icon="removeCircle"
							  class="entry-incomplete"></ion-icon>
					<ion-label>{{ labels.incomplete }}</ion-label>
				</ion-segment-button>
				<ion-segment-button :value="PARAMETERS.STATUS.ERROR"
									layout="icon-bottom">
					<ion-icon :icon="cloud"
							  class="entry-sync-error"></ion-icon>
					<ion-label>{{ labels.error }}</ion-label>
				</ion-segment-button>
			</ion-segment>
		</ion-item>

	</ion-content>
</template>

<script>
import { closeOutline, filter, cloud, removeCircle, cloudOutline } from 'ionicons/icons';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { reactive, computed } from '@vue/reactivity';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { databaseSelectService } from '@/services/database/database-select-service';

export default {
	props: {
		countNoFilters: {
			type: Number,
			required: true
		},
		countWithFilters: {
			type: Number,
			required: true
		},
		filters: {
			type: Object,
			required: true
		},
		ownerInputRef: {
			type: String,
			required: true
		},
		ownerEntryUuid: {
			type: String,
			required: true
		}
	},
	setup (props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { ownerInputRef, ownerEntryUuid } = readonly(props);
		let request_timeout;

		const state = reactive({
			isFetching: false,
			count: props.countWithFilters, //cloned in caller
			filters: props.filters, //cloned in caller
			searchbarInitialValue: props.filters.title
		});

		function _getBranchEntriesCount (params) {
			const { filters, ownerInputRef, ownerEntryUuid } = params;

			return new Promise((resolve) => {
				let response = {
					total: 0,
					//we need just the date YYYY-MM-DD
					newest: new Date().toISOString().split('T')[0],
					oldest: new Date().toISOString().split('T')[0]
				};

				(async () => {
					const result = await databaseSelectService.countBranchesForQuestion(
						ownerEntryUuid,
						ownerInputRef,
						filters,
						filters.status
					);
					if (result.rows.length > 0) {
						//any entries found?
						if (result.rows.item(0).total > 0) {
							response = {
								total: result.rows.item(0).total,
								//we need just the date YYYY-MM-DD
								oldest: result.rows.item(0).oldest.split('T')[0],
								newest: result.rows.item(0).newest.split('T')[0]
							};
						}
					}
					resolve(response);
				})();
			});
		}

		const computedScope = {
			countNoFilters: computed(() => {
				return props.countNoFilters;
			}),
			countWithFilters: computed(() => {
				return state.count;
			})
		};

		const methods = {
			dismiss () {
				modalController.dismiss({
					filters: state.filters,
					count: state.count
				});
			},
			filterByTitle (e) {
				const searchTerm = e.target.value;

				state.isFetching = true;
				// Throttle filter
				clearTimeout(request_timeout);
				request_timeout = window.setTimeout(async () => {
					state.filters.title = searchTerm;
					const result = await _getBranchEntriesCount({
						ownerEntryUuid,
						ownerInputRef,
						filters: state.filters
					});
					//re-count entries
					state.count = result.total;
					state.filters.oldest = result.oldest;
					state.filters.newest = result.newest;

					state.isFetching = false;
				}, PARAMETERS.DELAY_LONG);
			},
			async filterByStatus (e) {
				const status = e.target.value;
				console.log(status);
				state.isFetching = true;
				state.filters.status = status;
				setTimeout(async () => {
					const result = await _getBranchEntriesCount({
						ownerEntryUuid,
						ownerInputRef,
						filters: state.filters
					});
					//re-count entries
					state.count = result.total;
					state.filters.oldest = result.oldest;
					state.filters.newest = result.newest;
					state.isFetching = false;
				}, PARAMETERS.DELAY_LONG);
			},
			resetFilters () {
				state.isFetching = true;
				state.filters = { ...PARAMETERS.FILTERS_DEFAULT };
				setTimeout(async () => {
					const result = await _getBranchEntriesCount({
						ownerEntryUuid,
						ownerInputRef,
						filters: state.filters
					});
					//re-count entries
					state.count = result.total;
					state.filters.oldest = result.oldest;
					state.filters.newest = result.newest;
					state.filters.from = result.oldest;
					state.filters.to = result.newest;
					state.isFetching = false;
				}, PARAMETERS.DELAY_LONG);
			},
			filterByDate () {
				//v-model updates when picking a date in the datepicker
				state.isFetching = true;
				setTimeout(async () => {
					const result = await _getBranchEntriesCount({
						ownerEntryUuid,
						ownerInputRef,
						filters: state.filters
					});
					//re-count entries
					state.count = result.total;
					state.filters.oldest = result.oldest;
					state.filters.newest = result.newest;
					state.isFetching = false;
				}, PARAMETERS.DELAY_LONG);
			}
		};

		console.log('Current filters --->', state.filters);

		return {
			labels,
			state,
			PARAMETERS,
			...computedScope,
			...methods,
			//icons
			closeOutline,
			filter,
			cloud,
			removeCircle,
			cloudOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>