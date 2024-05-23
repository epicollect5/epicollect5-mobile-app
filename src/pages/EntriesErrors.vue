<template>
	<base-layout :title='state.projectName'>

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>

			<ion-button @click='openRightDrawer()'>
				<ion-icon
					slot='icon-only'
					:icon='ellipsisVertical'
				>
				</ion-icon>
			</ion-button>
		</template>

		<template #subheader>
			<ion-toolbar
				color='dark'
				mode='md'
			>
				<ion-buttons slot='start'>
					<ion-button @click='goToUploadPage()'>
						<ion-icon
							slot='start'
							:icon='chevronBackOutline'
						>
						</ion-icon>
						{{ labels.sync_now }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</template>

		<template #content>
			<ion-spinner
				v-if='state.isFetching'
				class='loader'
				name='crescent'
			>
			</ion-spinner>

			<div v-if="Object.keys(state.entriesInvalid).length > 0">
				<div
					v-for="(form, key, index) in state.entriesInvalid"
					:key="index"
				>
					<ion-toolbar
						color="light"
						class="form-name"
						mode="md"
					>
						<ion-title class="form-name-label-errors">
							{{ state.refNames[key] }}
						</ion-title>
					</ion-toolbar>

					<!-- todo: maybe useless, the loop goes over 'entries', 'branch_entries' keys -->
					<div
						v-for="(entriesObjects, key, index) in form"
						:key="index"
						class="entries-errors-item"
					>
						<!--entries-->
						<ion-list
							lines="full"
							class="ion-no-padding"
							v-if="form.entries !== undefined && key === 'entries'"
						>
							<ion-item
								v-for="(entry, key, index) in entriesObjects"
								:key="index"
							>
								<ion-label
									class="list-entries-item-title unwrap-fix"
									@click="viewEntry(entry)"
								>
									<ion-icon
										:icon="cloud"
										v-if="entry.synced === -1"
										class="entry-sync-error icon-error-entries"
									></ion-icon>
									<ion-icon
										:icon="bug"
										class="entry-sync-error icon-error-entries"
										v-if="entry.hasMediaError"
									></ion-icon>
									{{ entry.title }}
								</ion-label>
							</ion-item>
						</ion-list>

						<!--branch entries-->
						<div
							v-if="form.branch_entries !== undefined && key === 'branch_entries'"
							class="branch-entries-errors-item"
						>
							<ion-list
								lines="full"
								class="ion-no-padding"
								v-for="(branchEntries, branchRef, index) in entriesObjects"
								:key="index"
							>
								<ion-toolbar
									color="medium"
									class="form-name"
									mode="md"
								>
									<ion-title class="form-name-label-errors">
										{{ state.refNames[branchRef] }}
									</ion-title>
								</ion-toolbar>

								<ion-item
									v-for="(branchEntry, key, index) in branchEntries"
									:key="index"
								>
									<ion-label
										class="list-entries-item-title unwrap-fix"
										@click="viewEntry(branchEntry)"
										ng-class="left_column"
									>
										<icon-entry :entry="branchEntry"></icon-entry>
										{{ branchEntry.title }}
									</ion-label>
								</ion-item>
							</ion-list>
						</div>
					</div>
				</div>
			</div>
			<div v-else>
				<ion-card class="ion-text-center">
					<ion-card-header>
						<ion-card-title>{{ labels.no_errors_found }}</ion-card-title>
					</ion-card-header>
				</ion-card>
			</div>
		</template>
	</base-layout>
</template>

<script>
import { menuController } from '@ionic/vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { bug, cloud, chevronBackOutline, ellipsisVertical } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { useRouter, useRoute } from 'vue-router';
import { onMounted, watch } from 'vue';
import IconEntry from '@/components/IconEntry';
import { entryModel } from '@/models/entry-model';
import { useBackButton } from '@ionic/vue';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { entryService } from '@/services/entry/entry-service';

export default {
	components: { IconEntry },
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const router = useRouter();
		const route = useRoute();
		const scope = {};
		const state = reactive({
			isFetching: true,
			projectName: '',
			entriesInvalid: {},
			forms: projectModel.getForms(),
			refNames: {}
		});

		//get markup to show project logo in page header
		state.projectName = utilsService.getProjectNameMarkup();

		onMounted(async () => {
			console.log('Component Entries Errors is mounted!');
			// Retrieve the project and entries
			// Map form/branch refs to their names
			mapRefNames();
			// Retrieve the entries with errors
			getEntriesInvalid();
		});

		const methods = {
			openRightDrawer() {
				menuController.open('right-drawer');
			},
			goToUploadPage() {
				rootStore.nextRoute = router.currentRoute.value.name;
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
				});
			},
			viewEntry(entry) {
				// If the user edits an entry here, make sure they come back to this page when they're done
				// Set this route as the next route after editing/viewing error entries
				rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES_ERRORS;

				// If we have a main entry
				if (!entry.is_branch) {
					rootStore.routeParams = {
						entryUuid: entry.entry_uuid,
						parentEntryUuid: entry.parent_entry_uuid,
						formRef: entry.form_ref
					};

					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES_VIEW,
						query: {
							timestamp: Date.now()
						}
					});
				} else {
					// If we have a branch entry
					// We need to load the owner entry
					databaseSelectService.selectEntry(entry.owner_entry_uuid, null).then(function (res) {
						// Set up the owner entry
						const ownerEntry = entryModel;
						ownerEntry.initialise(res.rows.item(0));
						entryService.setUpExisting(ownerEntry).then(function () {
							// Go to the branch owner question
							rootStore.routeParams = {
								formRef: entry.form_ref,
								inputRef: entry.owner_input_ref,
								inputIndex: projectModel.getInputIndexFromRef(
									entry.form_ref,
									entry.owner_input_ref
								),
								error: { errors: [] }
							};

							router.replace({
								name: PARAMETERS.ROUTES.ENTRIES_ADD
							});
						});
					});
				}
			}
		};

		function mapRefNames() {
			let branchRef;
			const inputs = projectModel.getExtraInputs();
			let branches;

			for (const key in state.forms) {
				if (Object.prototype.hasOwnProperty.call(state.forms, key)) {
					// Map the forms
					state.refNames[key] = state.forms[key].details.name;
					// Map the branches
					branches = projectModel.getFormBranches(key);

					for (branchRef in branches) {
						if (Object.prototype.hasOwnProperty.call(inputs, branchRef)) {
							state.refNames[branchRef] =
								state.forms[key].details.name +
								' > ' +
								labels.branch +
								': ' +
								inputs[branchRef].data.question;
						}
					}
				}
			}

			console.log(state.refNames);
		}

		//Get the entries invalid for all forms and branches to be shown as a flat list
		//Epicollect5 server validation bails out after the first error though
		//multiple uploads attempts are needed
		async function getEntriesInvalid() {
			const projectRef = projectModel.getProjectRef();
			let title;
			let formRef;
			let ownerInputRef;
			let i;
			let entry;

			// Show loader
			await notificationService.showProgressDialog(labels.wait);
			state.isFetching = true;

			// Reset state.entriesInvalid
			state.entriesInvalid = {};

			// Get hierarchy entries with errors

			const entriesResult = await databaseSelectService.selectInvalidEntries(
				PARAMETERS.ENTRIES_TABLE,
				projectRef
			);

			//Build object using the form ref(s) as keys
			for (i = 0; i < entriesResult.rows.length; i++) {
				title = entriesResult.rows.item(i).title;
				formRef = entriesResult.rows.item(i).form_ref;

				entry = {
					title: title,
					entry_uuid: entriesResult.rows.item(i).entry_uuid,
					parent_entry_uuid: entriesResult.rows.item(i).parent_entry_uuid,
					form_ref: formRef,
					synced: entriesResult.rows.item(i).synced,
					can_edit: entriesResult.rows.item(i).can_edit,
					is_branch: false
				};
				state.entriesInvalid[formRef] = state.entriesInvalid[formRef] || {};
				state.entriesInvalid[formRef].entries = state.entriesInvalid[formRef].entries || [];
				state.entriesInvalid[formRef].entries.push(entry);
			}

			// Get branch entries with errors
			const branchEntriesResult = await databaseSelectService.selectInvalidEntries(
				PARAMETERS.BRANCH_ENTRIES_TABLE,
				projectRef
			);

			//Build object adding the branch_entries key to a form
			//and push all the invalid branch entries (per branch, using the branchRef)
			for (i = 0; i < branchEntriesResult.rows.length; i++) {
				title = branchEntriesResult.rows.item(i).title;
				formRef = branchEntriesResult.rows.item(i).form_ref;
				ownerInputRef = branchEntriesResult.rows.item(i).owner_input_ref;

				entry = {
					title: title,
					entry_uuid: branchEntriesResult.rows.item(i).entry_uuid,
					owner_input_ref: ownerInputRef,
					owner_entry_uuid: branchEntriesResult.rows.item(i).owner_entry_uuid,
					form_ref: formRef,
					synced: branchEntriesResult.rows.item(i).synced,
					can_edit: branchEntriesResult.rows.item(i).can_edit,
					is_branch: true
				};

				state.entriesInvalid[formRef] = state.entriesInvalid[formRef] || {};
				state.entriesInvalid[formRef].branch_entries =
					state.entriesInvalid[formRef].branch_entries || {};
				state.entriesInvalid[formRef].branch_entries[ownerInputRef] =
					state.entriesInvalid[formRef].branch_entries[ownerInputRef] || [];
				state.entriesInvalid[formRef].branch_entries[ownerInputRef].push(entry);
			}

			// Hide loader
			notificationService.hideProgressDialog();
			state.isFetching = false;

			console.log(state.entriesInvalid);
		}

		watch(
			() => [
				{
					refreshEntriesErrors: route.params.refreshEntriesErrors,
					timestamp: route.params.timestamp
				}
			],
			(changes) => {
				if (changes[0].refreshEntriesErrors === 'true') {
					getEntriesInvalid();
				}
			}
		);

		//back with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isFetching) {
				methods.goToUploadPage();
			}
		});

		return {
			labels,
			...methods,
			...scope,
			state,
			//icons
			bug,
			cloud,
			chevronBackOutline,
			ellipsisVertical
		};
	}
};
</script>

<style
	lang='scss'
	scoped
></style>