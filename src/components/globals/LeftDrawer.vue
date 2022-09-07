<template>
	<ion-menu
		side="start"
		menu-id="left-drawer"
		content-id="main"
		swipe-gesture="false"
	>
		<ion-header>
			<ion-toolbar
				color="primary"
				class="ion-text-center ion-text-uppercase"
			>
				{{labels.menu}}
			</ion-toolbar>
		</ion-header>
		<ion-content>
			<ion-list>
				<ion-item-group>
					<div
						v-if="isLoggedIn"
						class="user-label"
						lines="none"
					>
						<ion-label color="tertiary">
							<strong>{{labels.hi}}, {{ user.name}}</strong>
						</ion-label>
						<ion-label color="dark">
							<small>{{ user.email}}</small>
						</ion-label>
					</div>
				</ion-item-group>

				<ion-item
					@click="goToProjects()"
					lines="full"
				>
					<ion-icon :icon="document"></ion-icon>
					&nbsp;
					{{labels.projects}}
				</ion-item>
				<ion-item
					@click="goToSettings()"
					lines="full"
				>
					<ion-icon :icon="settings"></ion-icon>
					&nbsp;
					{{labels.settings}}
				</ion-item>
				<ion-item
					@click="goToCommunityPage()"
					lines="full"
				>
					<ion-icon :icon="people">
					</ion-icon>
					&nbsp;
					{{labels.help}}
				</ion-item>
				<ion-item
					@click="goToUserGuide()"
					lines="full"
				>
					<ion-icon :icon="book">
					</ion-icon>
					&nbsp;
					{{labels.user_guide}}
				</ion-item>
				<ion-item
					lines="full"
					@click="performAuthAction()"
				>
					<ion-icon :icon="personCircle">
					</ion-icon>
					&nbsp;
					{{authAction}}
				</ion-item>
				<ion-item-divider
					color="primary"
					class="ion-no-padding"
				>
					<ion-label class="item-divider-label-centered ion-text-uppercase">
						{{labels.my_bookmarks}}
					</ion-label>
				</ion-item-divider>
				<ion-item
					v-for="(bookmarkItem, index) in state.bookmarks"
					:key="index"
					lines="full"
					@click="goToBookmark(bookmarkItem)"
				>
					<ion-icon :icon="bookmark">
					</ion-icon>
					&nbsp;
					<ion-label>
						{{ bookmarkItem.title }}
					</ion-label>
				</ion-item>
				<ion-item
					v-if="state.bookmarks.length === 0"
					lines="full"
				>
					<ion-label class="ion-text-center">{{labels.no_bookmarks_found}}</ion-label>
				</ion-item>
			</ion-list>
		</ion-content>
	</ion-menu>

</template>

<script>
import * as icons from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import * as services from '@/services';
import { projectModel } from '@/models/project-model.js';
import { menuController } from '@ionic/vue';
import { showModalLogin } from '@/use/show-modal-login';
export default {
	setup() {
		const rootStore = useRootStore();
		const bookmarkStore = useBookmarkStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			//todo: test this maybe is not reactive like the user?
			bookmarks: bookmarkStore.bookmarks
		});

		const methods = {
			performAuthAction() {
				//todo: check this with different languages...
				if (rootStore.user.action === STRINGS[language].labels.login) {
					methods.openModalLogin();
				}
				if (rootStore.user.action === STRINGS[language].labels.logout) {
					methods.logout(true);
				}
			},
			goToProjects() {
				router.replace({
					name: PARAMETERS.ROUTES.PROJECTS,
					params: {}
				});
				menuController.close();
			},
			goToSettings() {
				rootStore.nextRoute = router.currentRoute.value.name;
				//todo: check with back button android
				router.replace({
					name: PARAMETERS.ROUTES.SETTINGS,
					params: {}
				});
				menuController.close();
			},
			async goToCommunityPage() {
				const hasInternetConnection = await services.utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					services.notificationService.showAlert(
						STRINGS[language].status_codes.ec5_135 + '!',
						labels.error
					);
				}
				window.open(PARAMETERS.COMMUNITY_SUPPORT_URL, '_system', 'location=yes');
			},
			async goToUserGuide() {
				const hasInternetConnection = await services.utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					services.notificationService.showAlert(
						STRINGS[language].status_codes.ec5_135 + '!',
						labels.error
					);
					return;
				}
				window.open(PARAMETERS.USER_GUIDE_URL, '_system', 'location=yes');
			},
			goToBookmark(bookmark) {
				// Remove current project from the store
				projectModel.destroy();
				// Add this entry uuid as parent entry uuid to the history
				rootStore.hierarchyNavigation = [...bookmark.bookmark.slice()];
				//navigate to saved bookmark
				rootStore.routeParams = {
					projectRef: bookmark.projectRef,
					formRef: bookmark.formRef
				};
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					params: {
						refreshEntries: 'true',
						timestamp: Date.now()
					}
				});
				//hide menu
				menuController.close();
			},
			async openModalLogin() {
				const hasInternetConnection = await services.utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					services.notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
				} else {
					await services.notificationService.showProgressDialog();

					// Call logout first
					methods.logout(false).then(
						() => {
							showModalLogin();
						},
						async function () {
							services.notificationService.hideProgressDialog();
							services.notificationService.showToast(STRINGS[language].status_codes.ec5_267);
						}
					);
				}
			},
			logout(showToast) {
				console.log('should log user out');
				/**
				 * Function to reset label, show toast etc after logout
				 * @private
				 */
				function _afterLogout() {
					rootStore.user = {
						action: STRINGS[language].labels.login,
						name: '',
						email: ''
					};

					if (showToast) {
						services.notificationService.showToast(STRINGS[language].status_codes.ec5_141);
					}
					menuController.close();
				}
				return new Promise((resolve) => {
					// Delete the current token
					services.databaseDeleteService.deleteToken().then(function () {
						if (rootStore.device.platform !== PARAMETERS.WEB) {
							// Attempt to logout google user
							window.plugins.googleplus.logout(
								async function (response) {
									_afterLogout();
									resolve();
								},
								function (error) {
									// If it failed, they weren't logged in to Google, so just call afterLogout and resolve
									_afterLogout();
									resolve();
								}
							);
						} else {
							_afterLogout();
							resolve();
						}
					});
				});
			}
		};

		console.log(rootStore.user);

		const computedScope = {
			authAction: computed(() => {
				return rootStore.user.action;
			}),
			isLoggedIn: computed(() => {
				return rootStore.user.email.length > 0;
			}),
			user: computed(() => {
				return rootStore.user;
			})
		};

		return {
			labels,
			state,
			...icons,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
</style>