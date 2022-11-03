<template>
	<!-- v-if to avoid re-rendering when going back to projects list -->
	<div>
		<ion-list
			class="list-entries ion-no-padding"
			lines="full"
			mode="md"
		>

			<toolbar-entries-filters
				:countWithFilters="countWithFilters"
				:countNoFilters="countNoFilters"
				@filters-clear="filtersClear()"
			>
			</toolbar-entries-filters>
			<ion-item
				v-show="countWithFilters >0"
				class="list-entries-item"
				v-for="entry in state.entriesChunk"
				:key="entry.uuid"
			>
				<ion-grid @click="viewEntry(entry)">
					<ion-row>
						<!-- Expand column to full width for single form projects -->
						<ion-col
							:size-xs="nextFormRef ? 8 : 12"
							:size-sm="nextFormRef ? 8 : 12"
							:size-md="nextFormRef ? 9 : 12"
							:size-lg="nextFormRef ? 9 : 12"
							:size-xl="nextFormRef ? 9 : 12"
						>
							<ion-label class="list-entries-item-title">
								<icon-entry :entry="entry"></icon-entry>
								{{entry.title}}
							</ion-label>
						</ion-col>
						<!-- Two columns layout to be shown for projects with multiple forms -->
						<ion-col
							size-xs="4"
							size-sm="4"
							size-md="3"
							size-lg="3"
							size-xl="3"
							class="list-entries-item-child"
							v-if="nextFormRef"
						>
							<ion-item
								lines="none"
								color="secondary"
								button
								class="child-entries-item-button"
								@click.stop="goToChildEntriesPage(entry.entry_uuid, entry.title)"
							>
								<ion-label> {{ formName }} </ion-label>
								<ion-icon
									:icon="chevronForward"
									slot="end"
								></ion-icon>
							</ion-item>
						</ion-col>

					</ion-row>
					<ion-row>
						<ion-col>
							<small class="entry-collected-on">
								<em>{{labels.collected_on + utcToLocal(entry.created_at)}}</em>
							</small>
						</ion-col>
					</ion-row>
				</ion-grid>

			</ion-item>
		</ion-list>
		<ion-infinite-scroll
			:disabled="countNoFilters <= PARAMETERS.ENTRIES_PER_PAGE"
			v-show="countWithFilters >0"
			@ionInfinite="loadEntriesChunk($event)"
			threshold="100px"
		>
			<ion-infinite-scroll-content
				loading-spinner="crescent"
				:loading-text="labels.loading"
			>
			</ion-infinite-scroll-content>
		</ion-infinite-scroll>
		<div v-show="countNoFilters === 0 || countWithFilters === 0">
			<ion-card class="ion-text-center">
				<ion-card-header>
					<ion-card-title>{{labels.no_entries_found}}</ion-card-title>
				</ion-card-header>
			</ion-card>
		</div>

	</div>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings';
import { chevronForward } from 'ionicons/icons';
import { reactive, computed, readonly, toRefs, ref } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { useRouter } from 'vue-router';
import { format } from 'date-fns';
import { fetchEntries } from '@/use/fetch-entries.js';
import { projectModel } from '@/models/project-model.js';
import ToolbarEntriesFilters from '@/components/ToolbarEntriesFilters';
import { inject } from 'vue';
import IconEntry from '@/components/IconEntry';

export default {
	components: { ToolbarEntriesFilters, IconEntry },
	props: {
		countNoFilters: {
			type: Number,
			required: true
		},
		countWithFilters: {
			type: Number,
			required: true
		},
		projectRef: {
			type: String,
			required: true
		},
		entries: {
			type: Array,
			required: true
		},
		nextFormRef: {
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
		filters: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			entriesChunk: [],
			isInfiniteScrollDisabled: false
		});
		const entriesState = inject('entriesState');

		const { formRef, parentEntryUuid, entries, projectRef, filters } = readonly(props);
		const { nextFormRef } = toRefs(props);
		console.log('Total entries ----------------->', entries.length);

		const methods = {
			viewEntry(entry) {
				// Project update cannot take place if navigating away
				rootStore.routeParams = {
					entryUuid: entry.entry_uuid,
					parentEntryUuid: parentEntryUuid,
					formRef: formRef
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_VIEW
				});
			},
			//Go to the entries page for the child of an entry
			goToChildEntriesPage(entryUuid, title) {
				// Project update cannot take place if navigating away
				rootStore.continueProjectVersionUpdate = false;

				// Add this entry uuid as parent entry uuid to the history
				const hierarchyNavigation = [...rootStore.hierarchyNavigation];
				hierarchyNavigation.push({
					parentEntryUuid: entryUuid,
					parentEntryName: title
				});
				rootStore.hierarchyNavigation = [...hierarchyNavigation];

				const routeParams = { ...rootStore.routeParams };
				routeParams.formRef = nextFormRef.value;
				rootStore.routeParams = routeParams;

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					params: {
						refreshEntries: 'true',
						timestamp: Date.now()
					}
				});
			},

			utcToLocal(utcDateString) {
				return format(new Date(utcDateString), 'dd MMM, yyyy @ h:mma');
			},
			loadEntriesChunk(ev) {
				async function pushEntriesChunk() {
					return new Promise((resolve) => {
						const offset = PARAMETERS.ENTRIES_PER_PAGE;
						const max = state.entriesChunk.length + offset;
						const min = max - offset;

						const fetchParams = {
							projectRef,
							formRef,
							parentEntryUuid,
							currentEntryOffset: min,
							filters,
							status: filters.status
						};

						fetchEntries(fetchParams).then((response) => {
							if (response.entries.length > 0) {
								state.entriesChunk.push(...response.entries);
							} else {
								state.isInfiniteScrollDisabled = true;
							}
							resolve();
						});
					});
				}

				setTimeout(async () => {
					await pushEntriesChunk();
					console.log('Loaded entries chunk');
					if (ev) {
						ev.target.complete();
					}
					if (state.isInfiniteScrollDisabled) {
						ev.target.disabled = true;
					}
				}, PARAMETERS.DELAY_MEDIUM);
			},
			filtersClear() {
				//reset all filters
				entriesState.filters = { ...PARAMETERS.FILTERS_DEFAULT };

				//reload page to re-fecth entries
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					params: {
						refreshEntries: 'true',
						timestamp: Date.now()
					}
				});
			}
		};

		const computedScope = {
			formName: computed(() => {
				return nextFormRef.value ? projectModel.getFormName(nextFormRef.value) : '';
			})
		};

		onMounted(async () => {
			console.log('List Entries is mounted.');
			state.entriesChunk = entries.slice(0, PARAMETERS.ENTRIES_PER_PAGE);
			//disable infinite scroll when not needed
			if (state.entriesChunk.length >= props.countNoFilters) {
				state.isInfiniteScrollDisabled = true;
			}
		});

		return {
			labels,
			...methods,
			...props,
			...computedScope,
			state,
			PARAMETERS,
			//icons
			chevronForward
		};
	}
};
</script>