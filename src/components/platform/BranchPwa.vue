<template>
	<ion-row>
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
			<ion-spinner
				v-if="state.isFetching"
				class="ion-margin"
				name="crescent"
			></ion-spinner>
			<div
				v-if="!state.isFetching && state.branchEntries.length > 0"
				class="list-entries-branch"
			>
				<ion-list
					class="animate__animated animate__fadeIn"
					lines="none"
					mode="md"
				>
					<ion-item
						lines="full"
						class="list-entries-item"
						v-for="entry in state.branchEntries"
						:key="entry.id"
					>
						<ion-icon
							class="icon-primary"
							:icon="create"
							slot="start"
							@click="editBranchPWA(entry.id)"
						></ion-icon>

						<ion-label
							v-if="hasPWABranchUploadError(entry.id)"
							color="danger"
							class="ion-text-nowrap"
						>
							<ion-icon
								class="icon-danger pwa-branch-upload-error"
								:icon="alertCircle"
							></ion-icon>
							{{ entry.branch_entry.title }}
						</ion-label>
						<ion-label
							v-else
							class="ion-text-nowrap"
						>
							{{ entry.branch_entry.title }}
						</ion-label>
						<ion-icon
							class="icon-danger"
							:icon="trash"
							slot="end"
							@click="removeBranchPWA(entry.id)"
						></ion-icon>
					</ion-item>
				</ion-list>

				<ion-infinite-scroll
					:disabled="state.branchEntries.length <= PARAMETERS.ENTRIES_PER_PAGE"
					v-show="state.branchEntries.length > 0"
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
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { create, trash, alertCircle } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { projectModel } from '@/models/project-model.js';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { notificationService } from '@/services/notification-service';

export default {
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
	emits: ['load-entries-chunk'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = props.parentState;
		const entriesAddScope = rootStore.entriesAddScope;
		const projectRef = projectModel.getProjectRef();

		const methods = {
			hasPWABranchUploadError(branchUuid) {
				//check the branch uuid only, as we can have errors
				//in any branch question
				//One error will flag the whole branch as invalid
				return Object.values(rootStore.queueBranchUploadErrorsPWA).some((errors) => {
					return errors.some((error) => {
						return error.uuid === branchUuid;
					});
				});
			},
			async removeBranchPWA(id) {
				//ask delete confirmation
				const confirmed = await notificationService.confirmSingle(
					labels.are_you_sure,
					labels.delete
				);

				if (confirmed) {
					//remove branch from store
					state.branchEntries = state.branchEntries.filter((entry) => {
						return entry.id !== id;
					});

					if (state.branchEntries.length > 0) {
						rootStore.queueTempBranchEntriesPWA[props.inputRef] = state.branchEntries;
					} else {
						//remove branch key when no branch entries
						delete rootStore.queueTempBranchEntriesPWA[props.inputRef];
					}
				}
			},
			async editBranchPWA(id) {
				const formRef = entriesAddScope.entryService.entry.formRef;
				const entry = state.branchEntries.find((entry) => {
					return entry.id === id;
				});
				const branchEntry = {
					entryUuid: entry.id,
					ownerEntryUuid: entry.relationships.branch.data.owner_entry_uuid,
					ownerInputRef: entry.relationships.branch.data.owner_input_ref,
					isRemote: 0,
					synced: 0,
					canEdit: 1,
					createdAt: entry.branch_entry.created_at,
					title: entry.branch_entry.title,
					formRef,
					projectRef,
					media: {},
					uniqueAnswers: {},
					syncedError: '',
					isBranch: true,
					answers: entry.branch_entry.answers
				};
				// Show loader
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);
				//edit on PWA always start from first question
				await branchEntryService.setUpExisting(branchEntry);
				rootStore.routeParams = {
					formRef,
					inputRef: '',
					inputIndex: 0,
					error: state.error,
					isBranch: true,
					branchEntryUuid: id // -> pass this to avoid errors on ALL the branches ;)
				};

				//keep the address bar on the entry url (see addBranch)
				const currentUrl = window.location.pathname + window.location.search;

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				}).then(() => {
					if (rootStore.isPWA) {
						window.history.replaceState(window.history.state, '', currentUrl);
					}
				});
			},
			loadEntriesChunk(ev) {
				//the chunk loader mutates the shared fetch state, so it stays in
				//the wrapper and the lists forward the scroll events to it
				context.emit('load-entries-chunk', ev);
			}
		};

		return {
			labels,
			state,
			PARAMETERS,
			...methods,
			//icons
			create,
			trash,
			alertCircle
		};
	}
};
</script>
