<template>
	<ion-menu
		side="start"
		menu-id="left-drawer"
		content-id="main"
		swipe-gesture="false"
	>
		<ion-header class="ion-no-border">
			<ion-toolbar
				color="primary"
				class="ion-text-center ion-text-uppercase"
				data-translate="menu"
			>
				{{ labels.menu }}
			</ion-toolbar>
		</ion-header>
		<ion-content>
			<ion-list>

				<ion-item-group
					v-if="isLoggedIn"
					class="profile"
					data-test="profile"
					@click="goToProfile()"
				>
					<ion-grid>
						<ion-row>
							<ion-col size="9">
								<div
									class="profile__label"
									lines="none"
								>
									<ion-label
										color="tertiary"
										class="ion-text-nowrap"
									>
										<strong>{{ labels.hi }}, {{ user.name }}</strong>
									</ion-label>
									<ion-label
										color="dark"
										class="ion-text-nowrap"
									>
										<small>{{ user.email }}</small>
									</ion-label>

								</div>
							</ion-col>
							<ion-col
								size="3"
								class="ion-text-end"
							>
								<ion-icon
									class="profile__icon"
									:icon="enter"
									size="large"
								></ion-icon>
							</ion-col>
						</ion-row>
					</ion-grid>
				</ion-item-group>

				<ion-item
					@click="goToProjects()"
					data-test="projects"
					lines="full"
				>
					<ion-icon :icon="document"></ion-icon>
					<ion-label
						data-translate="projects"
						class="ion-text-nowrap"
					>
						&nbsp;
						{{ labels.projects }}
					</ion-label>

				</ion-item>
				<ion-item
					data-test="settings"
					@click="goToSettings()"
					lines="full"
				>
					<ion-icon :icon="settings"></ion-icon>
					<ion-label
						data-translate="settings"
						class="ion-text-nowrap"
					>
						&nbsp;
						{{ labels.settings }}
					</ion-label>
				</ion-item>
				<ion-item
					@click="goToCommunityPage()"
					data-test="community"
					lines="full"
				>
					<ion-icon :icon="people">
					</ion-icon>
					<ion-label
						data-translate="help"
						class="ion-text-nowrap"
					>
						&nbsp;
						{{ labels.help }}
					</ion-label>
				</ion-item>
				<ion-item
					data-test="user-guide"
					@click="goToUserGuide()"
					lines="full"
				>
					<ion-icon :icon="book">
					</ion-icon>
					<ion-label
						data-translate="user_guide"
						class="ion-text-nowrap"
					>
						&nbsp;
						{{ labels.user_guide }}
					</ion-label>
				</ion-item>
				<ion-item
					lines="full"
					data-test="performAuthAction"
					@click="performAuthAction()"
				>
					<ion-icon :icon="personCircle">
					</ion-icon>
					<ion-label class="ion-text-nowrap">
						&nbsp;
						{{ authAction }}
					</ion-label>
				</ion-item>
				<ion-item-divider
					color="primary"
					class="ion-no-padding"
				>
					<ion-label
						class="item-divider-label-centered ion-text-uppercase"
						data-translate="my_bookmarks"
					>
						{{ labels.my_bookmarks }}
					</ion-label>
				</ion-item-divider>
				<ion-item
					v-for="(bookmarkItem) in state.bookmarks"
					:key="bookmarkItem.id"
					lines="full"
					data-test="bookmarks"
					@click="goToBookmark(bookmarkItem)"
				>
					<ion-icon :icon="bookmark">
					</ion-icon>
					&nbsp;
					<ion-label class="ion-text-nowrap">
						{{ bookmarkItem.title }}
					</ion-label>
				</ion-item>
				<ion-item
					v-if="state.bookmarks.length === 0"
					lines="full"
				>
					<ion-label
						class="ion-text-center ion-text-nowrap"
						data-translate="no_bookmarks_found"
					>{{ labels.no_bookmarks_found }}</ion-label>
				</ion-item>
			</ion-list>
		</ion-content>
	</ion-menu>
</template>

<script>
import { enter, document, bookmark, personCircle, book, people, settings } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { menuController } from '@ionic/vue';
import { showModalLogin } from '@/use/show-modal-login';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';
import { logout } from '@/use/logout';

export default {
	setup() {
		const rootStore = useRootStore();
		const bookmarkStore = useBookmarkStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			bookmarks: bookmarkStore.bookmarks
		});

		const methods = {
			performAuthAction() {
				//todo: check this with different languages...
				if (rootStore.user.action === STRINGS[language].labels.login) {
					methods.openModalLogin();
				}
				if (rootStore.user.action === STRINGS[language].labels.logout) {
					methods.logout(true, true);
				}
			},
			goToProfile() {
				//console.log(router.currentRoute.value.name);
				//console.log(router.currentRoute._value?.name);
				rootStore.nextRoute = router.currentRoute.value.name;
				console.log(rootStore.nextRoute);
				router.replace({
					name: PARAMETERS.ROUTES.PROFILE
				});
				menuController.close();
			},
			goToProjects() {
				//reset hierarchy navigation
				rootStore.hierarchyNavigation = [];
				//reset models
				projectModel.destroy();
				formModel.destroy();

				router.replace({
					name: PARAMETERS.ROUTES.PROJECTS
				});
				menuController.close();
			},
			goToSettings() {
				rootStore.nextRoute = router.currentRoute.value.name;
				//todo: check with back button android
				router.replace({
					name: PARAMETERS.ROUTES.SETTINGS
				});
				menuController.close();
			},
			async goToCommunityPage() {
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
					return false;
				}
				window.open(PARAMETERS.COMMUNITY_SUPPORT_URL, '_system', 'location=yes');
			},
			async goToUserGuide() {
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
					return false;
				}
				window.open(PARAMETERS.USER_GUIDE_URL, '_system', 'location=yes');
			},
			goToBookmark(bookmark) {

				console.log(bookmark);
				// Remove current project from the store
				projectModel.destroy();
				formModel.destroy();
				rootStore.routeParams = {};
				rootStore.hierarchyNavigation = [];
				// Add this entry uuid as parent entry uuid to the history
				rootStore.hierarchyNavigation = [...bookmark.hierarchyNavigation.slice()];

				console.log(rootStore.hierarchyNavigation);
				//navigate to saved bookmark
				rootStore.routeParams = {
					projectRef: bookmark.projectRef,
					formRef: bookmark.formRef
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES,
					query: {
						refreshEntries: 'true',
						timestamp: Date.now()
					}
				});
				//hide menu
				menuController.close();
			},
			async openModalLogin() {
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
				} else {
					await notificationService.showProgressDialog();
					//Call logout first
					methods.logout(false, true).then(
						() => {
							showModalLogin();
						},
						async function () {
							notificationService.hideProgressDialog();
							notificationService.showToast(STRINGS[language].status_codes.ec5_267);
						}
					);
				}
			},
			async logout(showToast, closeMenu) {
				console.log('should log user out');
				return new Promise((resolve) => {
					logout().then(() => {
						if (showToast) {
							notificationService.showToast(STRINGS[language].status_codes.ec5_141);
						}
						if (closeMenu) {
							menuController.close();
						}
						resolve();
					});
				});
			}
		};

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
			...methods,
			...computedScope,
			//icons*******
			document,
			bookmark,
			personCircle,
			book,
			people,
			settings,
			enter
			//************
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>