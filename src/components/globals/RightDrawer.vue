<template>
	<ion-menu
		side="end"
		menu-id="right-drawer"
		content-id="main"
		@ionWillClose="onMenuWillClose()"
		swipe-gesture="false"
	>
		<ion-header class="ion-no-border">
			<ion-toolbar
				color="primary"
				class="ion-text-center ion-text-uppercase"
			>
				<ion-label data-translate="project_options">{{ labels.project_options }}</ion-label>
			</ion-toolbar>
		</ion-header>
		<ion-content ref="drawerContent">
			<ion-list>
				<ion-item
					button
					data-test="upload-page"
					@click="goToUploadPage()"
				>
					<ion-icon :icon="cloudUpload">
					</ion-icon>
					<ion-label data-translate="upload_entries">
						&nbsp;{{ labels.upload_entries }}
					</ion-label>
				</ion-item>
				<ion-item
					button
					data-test="download-page"
					@click="goToDownloadPage()"
				>
					<ion-icon :icon="cloudDownload">
					</ion-icon>
					<ion-label data-translate="download_entries"> &nbsp;{{ labels.download_entries }}</ion-label>
				</ion-item>

				<ion-item
					button
					data-test="unsync-entries"
					@click="unsyncAllEntries()"
				>
					<ion-icon :icon="unlink">
					</ion-icon>
					<ion-label data-translate="unsync_all_entries">
						&nbsp;{{ labels.unsync_all_entries }}
					</ion-label>
				</ion-item>

				<!-- <ion-item @click="exportAllEntries()">
					<ion-icon :icon="download">
					</ion-icon>
					&nbsp;{{labels.export_all_entries}}<sup>Beta</sup>
				</ion-item> -->

				<ion-item
					button
					data-test="bookmark-add"
					v-if="!isBookmarked"
					@click="openModalBookmarkAdd()"
				>
					<ion-icon :icon="bookmark">
					</ion-icon>
					<ion-label data-translate="bookmark_page">&nbsp;{{ labels.bookmark_page }}</ion-label>
				</ion-item>
				<ion-item
					button
					data-test="bookmark-remove"
					v-else
					@click="removeBookmark()"
				>
					<ion-icon :icon="bookmark">
					</ion-icon>
					<ion-label data-translate="remove_bookmark">&nbsp;{{ labels.remove_bookmark }}</ion-label>
				</ion-item>
				<ion-item
					button
					data-test="project-info"
					@click="showProjectInfo()"
				>
					<ion-icon :icon="informationCircle">
					</ion-icon>
					<ion-label data-translate="project_info">&nbsp;{{ labels.project_info }}</ion-label>
				</ion-item>
				<ion-item
					button
					data-test="project-info"
					@click="editRemoteEntries()"
				>
					<ion-icon :icon="desktopOutline">
					</ion-icon>
					<ion-label data-translate="edit_remote_entries">&nbsp;{{ labels.edit_remote_entries }}</ion-label>
				</ion-item>
				<!-- <ion-item
					button
					data-test="invite"
					@click="invite()"
				>
					<ion-icon :icon="people">
					</ion-icon>
					<ion-label data-translate="invite">&nbsp;{{ labels.invite }}</ion-label>
				</ion-item> -->
				<ion-item-divider
					color="primary"
					class="ion-no-padding"
				>
					<ion-label
						class="item-divider-label-centered ion-text-uppercase"
						data-translate="sort"
					>
						{{ labels.sort }}
					</ion-label>
				</ion-item-divider>
				<ion-item
					button
					data-test="sort-by-az"
					@click="sortBy('title', 'ASC')"
				>
					<ion-icon :icon="arrowUpCircle">
					</ion-icon>
					&nbsp;A-Z
					<ion-icon
						v-if="state.order.field === 'title' && state.order.sortType === 'ASC'"
						:icon="checkmark"
						slot="end"
					>
					</ion-icon>
				</ion-item>
				<ion-item
					button
					data-test="sort-by-za"
					@click="sortBy('title', 'DESC')"
				>
					<ion-icon :icon="arrowDownCircle">
					</ion-icon>
					&nbsp;Z-A
					<ion-icon
						v-if="state.order.field === 'title' && state.order.sortType === 'DESC'"
						:icon="checkmark"
						slot="end"
					>
					</ion-icon>
				</ion-item>
				<ion-item
					button
					data-test="sort-by-newest"
					@click="sortBy('created_at', 'DESC')"
				>
					<ion-icon :icon="timeOutline">
					</ion-icon>
					<ion-label data-translate="newest">&nbsp;{{ labels.newest }}</ion-label>
					<ion-icon
						v-if="state.order.field === 'created_at' && state.order.sortType === 'DESC'"
						:icon="checkmark"
						slot="end"
					>
					</ion-icon>
				</ion-item>
				<ion-item
					button
					data-test="sort-by-oldest"
					@click="sortBy('created_at', 'ASC')"
				>
					<ion-icon :icon="timeOutline">
					</ion-icon>
					<ion-label data-translate="oldest">&nbsp;{{ labels.oldest }}</ion-label>
					<ion-icon
						v-if="state.order.field === 'created_at' && state.order.sortType === 'ASC'"
						:icon="checkmark"
						slot="end"
					>
					</ion-icon>
				</ion-item>
				<ion-item-divider
					color="danger"
					class="ion-no-padding"
				>
					<ion-label
						class="item-divider-label-centered ion-text-uppercase"
						data-translate="delete"
					>
						{{ labels.delete }}
					</ion-label>
				</ion-item-divider>
				<ion-item
					button
					data-test="delete-entries"
					@click="deleteEntries()"
				>
					<ion-icon
						class="icon-danger"
						:icon="trash"
					>
					</ion-icon>
					<ion-label
						color="danger"
						data-translate="delete_all_entries"
					>
						&nbsp;{{ labels.delete_all_entries }}
					</ion-label>
				</ion-item>
				<ion-item
					button
					data-test="delete-project"
					@click="deleteProject()"
				>
					<ion-icon
						class="icon-danger"
						:icon="trash"
					>
					</ion-icon>
					<ion-label
						color="danger"
						data-translate="delete_project"
					>
						&nbsp;{{ labels.delete_project }}
					</ion-label>
				</ion-item>
			</ion-list>
		</ion-content>
	</ion-menu>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { useDBStore } from '@/stores/db-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { STRINGS } from '@/config/strings';
import { utilsService } from '@/services/utilities/utils-service';
import { Share } from '@capacitor/share';

import {
	cloudUpload,
	cloudDownload,
	unlink,
	bookmark,
	informationCircle,
	trash,
	people,
	checkmark,
	arrowUpCircle,
	arrowDownCircle,
	timeOutline,
	logoChrome,
	desktopOutline
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import { deleteProject } from '@/use/delete-project';
import { deleteEntries } from '@/use/delete-entries';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { modalController, menuController } from '@ionic/vue';
import { ref, reactive, computed } from '@vue/reactivity';
import ModalProjectInfo from '@/components/modals/ModalProjectInfo';
import ModalBookmarkAdd from '@/components/modals/ModalBookmarkAdd';
import { notificationService } from '@/services/notification-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { exportService } from '@/services/export-service';

export default {
	setup() {
		const rootStore = useRootStore();
		const dbStore = useDBStore();
		const bookmarkStore = useBookmarkStore();
		const router = useRouter();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			order: dbStore.dbEntriesOrder
		});

		const drawerContent = ref(null);
		const scope = {};
		const computedScope = {
			isBookmarked: computed(() => {
				console.log('the bookmark ID is ', bookmarkStore.bookmarkId);
				return bookmarkStore.bookmarkId !== null;
			})
		};

		const methods = {
			onMenuWillClose() {
				//scroll menu to top
				//imp:does not work after the menu is closed, so onWillClose is used
				drawerContent.value.$el.scrollToTop(PARAMETERS.DELAY_FAST);
			},
			async exportAllEntries() {
				//todo:
				const projectRef = projectModel.getProjectRef();
				const projectSlug = projectModel.getSlug();
				//show loader
				await notificationService.showProgressDialog(labels.wait);
				//export all hierarchy entries
				try {
					await exportService.exportHierarchyEntries(projectRef, projectSlug);
				} catch (error) {
					notificationService.hideProgressDialog();
					notificationService.showAlert(error);
				}
				//export all branch entries
				try {
					await exportService.exportBranchEntries(projectRef, projectSlug);
				} catch (error) {
					notificationService.hideProgressDialog();
					notificationService.showAlert(error);
				}
				//export all media files (skip for the web)
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					try {
						await exportService.exportMedia(projectRef, projectSlug);
						notificationService.hideProgressDialog();
						notificationService.showAlert(
							//downloadFolder + projectSlug,
							labels.all_entries_downloaded
						);
						menuController.close();
					} catch (error) {
						console.log(error);
						notificationService.hideProgressDialog();
						notificationService.showAlert(error);
					}
				} else {
					//just remove the loader on the web, for testing
					notificationService.hideProgressDialog();
					notificationService.showAlert(labels.all_entries_downloaded);
					menuController.close();
				}
			},
			//todo
			deleteProject() {
				//try to delete current project and redirect to projects list
				deleteProject(router);
			},
			deleteEntries() {
				//try to delete all entries and reload  entries page
				deleteEntries(router);
			},
			async unsyncAllEntries() {
				const projectRef = projectModel.getProjectRef();
				await notificationService.showProgressDialog(labels.wait);

				//todo: should catch errors...
				await databaseUpdateService.unsyncAllEntries(projectRef);
				await databaseUpdateService.unsyncAllBranchEntries(projectRef);
				await databaseUpdateService.unsyncAllFileEntries(projectRef);

				notificationService.hideProgressDialog();
				notificationService.showToast(labels.unsynced);
				// Refresh view
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					query: {
						refreshEntries: true
					}
				});
				//hide right drawer
				menuController.close();
			},
			async showProjectInfo() {
				scope.ModalProjectInfo = await modalController.create({
					cssClass: 'modal-project-info',
					component: ModalProjectInfo,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {}
				});

				return scope.ModalProjectInfo.present();
			},

			async editRemoteEntries() {
				const slug = projectModel.getSlug();
				const datapage = rootStore.serverUrl + PARAMETERS.API.ROUTES.PROJECT + slug + '/data';

				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
					state.isFetching = false;
					return;
				}
				window.open(datapage, '_system', 'location=yes');
			},

			async sortBy(field, sortType) {
				const dbStore = useDBStore();
				// Sanitise the field and sort type, as they will be used in db queries
				const dbField =
					PARAMETERS.ALLOWED_ORDERING_COLUMNS.indexOf(field) > -1
						? field
						: PARAMETERS.DEFAULT_ORDERING_COLUMN;
				const dbSortType =
					PARAMETERS.ALLOWED_ORDERING.indexOf(sortType) > -1
						? sortType
						: PARAMETERS.DEFAULT_ORDERING;

				dbStore.dbEntriesOrder = { field: dbField, sortType: dbSortType };
				state.order = dbStore.dbEntriesOrder;

				// Insert the new order by into the database
				await databaseInsertService.insertSetting(
					'order_by',
					JSON.stringify(dbStore.dbEntriesOrder)
				);

				//reload page to re-fetch entries
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					query: {
						refreshEntries: true,
						timestamp: Date.now()
					}
				});
			},
			async openModalBookmarkAdd() {
				let bookmarkTitle = '';
				const hierarchyNavigation = rootStore.hierarchyNavigation;

				if (hierarchyNavigation.length > 0) {
					bookmarkTitle = hierarchyNavigation[hierarchyNavigation.length - 1].parentEntryName;
					bookmarkTitle += ' - ' + formModel.getName();
				} else {
					bookmarkTitle = projectModel.getProjectName();
				}

				//bookmark title max length is 50
				bookmarkTitle = utilsService.trunc(bookmarkTitle, 50, false);

				scope.ModalBookmarkAdd = await modalController.create({
					cssClass: 'modal-bookmark-add',
					component: ModalBookmarkAdd,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						bookmarkTitle,
						formRef: formModel.formRef,
						projectRef: projectModel.getProjectRef()
					}
				});

				scope.ModalBookmarkAdd.onDidDismiss().then((response) => {
					//hide right drawer
					menuController.close();
				});
				return scope.ModalBookmarkAdd.present();
			},
			async removeBookmark() {
				// Retrieve bookmarkid from current bookmark
				const bookmarkId = bookmarkStore.bookmarkId;
				try {
					await bookmarksService.deleteBookmark(bookmarkId);
					// Remove this page as bookmarked
					bookmarkStore.bookmarkId = null;
					notificationService.showToast(STRINGS[language].status_codes.ec5_127);
				} catch (error) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_104);
				}
				menuController.close();
			},
			goToDownloadPage() {
				rootStore.nextRoute = router.currentRoute.value.name;
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_DOWNLOAD
				});
				menuController.close();
			},
			goToUploadPage() {
				rootStore.nextRoute = router.currentRoute.value.name;
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
				});
				menuController.close();
			},
			async invite() {
				try {
					await Share.share({
						title: 'Join ' + projectModel.getProjectName() + ' on Epicollect5',
						text: 'Tap the link on your Android or iOS device to join',
						url: rootStore.serverUrl + '/open/project/' + projectModel.getSlug(),
						dialogTitle: 'Join ' + projectModel.getProjectName() + ' on Epicollect5'
					});
				}
				catch (error) {
					console.log('User cancelled shared action');
				}
			}
		};


		return {
			labels,
			state,
			...computedScope,
			...methods,
			drawerContent,
			//icons**********
			cloudUpload,
			cloudDownload,
			unlink,
			bookmark,
			informationCircle,
			trash,
			people,
			checkmark,
			arrowUpCircle,
			arrowDownCircle,
			timeOutline,
			logoChrome,
			desktopOutline
			//*****************
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>