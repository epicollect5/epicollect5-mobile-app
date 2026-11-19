<template>
	<ion-row>
		<ion-col>
			<ion-spinner
				v-if="state.isFetching"
				class="ion-margin"
				name="crescent"
			></ion-spinner>
			<div
				v-if="!state.isFetching && state.countNoFilters > 0"
				class="list-entries-branch"
			>
				<ion-list
					class="animate__animated animate__fadeIn"
					lines="full"
					mode="md"
				>

					<toolbar-entries-filters
						:countWithFilters="state.countWithFilters"
						:countNoFilters="state.countNoFilters"
						@filters-clear="filtersClear()"
					>
					</toolbar-entries-filters>
					<ion-item
						class="list-entries-item"
						v-for="entry in state.branchEntries"
						:key="entry.uuid"
						@click="viewBranch(entry.entry_uuid)"
					>
						<ion-grid>
							<ion-row>
								<ion-col>
									<ion-label>
										<icon-entry :entry="entry"></icon-entry>
										{{ entry.title }}
									</ion-label>
								</ion-col>

							</ion-row>
							<ion-row>
								<ion-col>
									<small class="text-left collected-on">
										{{ labels.collected_on + utcToLocal(entry.created_at) }}
									</small>
								</ion-col>
							</ion-row>
						</ion-grid>
					</ion-item>
				</ion-list>

				<ion-infinite-scroll
					:disabled="state.countNoFilters <= PARAMETERS.ENTRIES_PER_PAGE"
					v-show="state.countWithFilters > 0"
					@ionInfinite="loadEntriesChunk($event)"
					threshold="100px"
					class="ion-padding-top"
				>
					<ion-infinite-scroll-content
						loading-spinner="crescent"
						:loading-text="labels.loading"
					>
					</ion-infinite-scroll-content>
				</ion-infinite-scroll>
			</div>

		</ion-col>
	</ion-row>
	<ion-row v-if="!state.isFetching && state.branchEntries.length === 0">
		<ion-col
			size-xs="10"
			offset-xs="1"
			size-sm="8"
			offset-sm="2"
			size-md="6"
			offset-md="3"
			size-lg="6"
			offset-lg="3"
			class="ion-align-self-center"
		>
			<ion-item
				class="ion-text-center ion-margin-bottom"
				lines="none"
			>
				<ion-label>{{ labels.no_entries_found }}</ion-label>
			</ion-item>

		</ion-col>
	</ion-row>
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { format } from 'date-fns';
import { projectModel } from '@/models/project-model.js';
import ToolbarEntriesFilters from '@/components/toolbars/ToolbarEntriesFilters.vue';
import IconEntry from '@/components/IconEntry';

export default {
	components: {
		ToolbarEntriesFilters,
		IconEntry
	},
	props: {
		parentState: {
			type: Object,
			required: true
		},
		inputRef: {
			type: String,
			required: true
		}
	},
	emits: ['load-entries-chunk', 'filters-clear'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = props.parentState;
		const entriesAddScope = rootStore.entriesAddScope;
		const projectRef = projectModel.getProjectRef();

		const methods = {
			viewBranch(entryUuid) {
				rootStore.routeParams = {
					projectRef,
					formRef: entriesAddScope.entryService.entry.formRef,
					ownerInputRef: props.inputRef,
					ownerEntryUuid: entriesAddScope.entryService.entry.entryUuid,
					entryUuid: entryUuid
				};

				//todo: push or replace?
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH
				});
			},
			utcToLocal(utcDateString) {
				return format(new Date(utcDateString), 'dd MMM, yyyy @ h:mma');
			},
			loadEntriesChunk(ev) {
				//the chunk loader mutates the shared fetch state, so it stays in
				//the wrapper and the lists forward the scroll events to it
				context.emit('load-entries-chunk', ev);
			},
			filtersClear() {
				//same as the chunk loader: filters live in the wrapper, the
				//native toolbar forwards the clear request
				context.emit('filters-clear');
			}
		};

		return {
			labels,
			state,
			PARAMETERS,
			...methods
		};
	}
};
</script>
