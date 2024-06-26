<template>
	<base-layout title="">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<ion-button
				fill="clear"
				@click="saveSettings()"
			>
				<ion-icon
					slot="start"
					:icon="checkmark"
				></ion-icon>
				{{ labels.save }}
			</ion-button>
		</template>

		<template #subheader>
			<ion-toolbar color="dark">
				<ion-buttons slot="start">
					<ion-button @click="goBack()">
						<ion-icon
							slot="start"
							:icon="chevronBackOutline"
						>
						</ion-icon>
						{{ labels.back }}
					</ion-button>
				</ion-buttons>
				<ion-buttons
					class="toolbar-spacer"
					slot="end"
				>
					<ion-button>
						<ion-icon
							slot="end"
							:icon="chevronBackOutline"
						>
						</ion-icon>
						{{ labels.back }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</template>

		<template #content>
			<ion-toolbar
				color="light"
				mode="ios"
				class="animate__animated animate__fadeIn"
			>
				<div class="center-item-content-wrapper">
					<ion-label class="ion-text-center ion-text-uppercase ">
						{{ labels.settings }}
					</ion-label>
				</div>
			</ion-toolbar>
			<ion-card>
				<ion-card-header class="settings-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.accessibility }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-left ion-no-padding">
					<ion-item
						lines="full"
						class="ion-text-left"
					>
						<ion-label>{{ labels.text_size }}</ion-label>
					</ion-item>
					<ion-item lines="none">
						<ion-range
							min="0"
							:max="zoomLevels"
							step="1"
							debounce="500"
							snaps="true"
							ticks="true"
							:value="state.selectedTextSize"
							@ionChange="updateSelectedTextSize($event)"
						>
							<ion-icon
								slot="start"
								:icon="remove"
							></ion-icon>
							<ion-icon
								slot="end"
								:icon="add"
							></ion-icon>
						</ion-range>
					</ion-item>
				</ion-card-content>
			</ion-card>

			<ion-card>
				<ion-card-header class="settings-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.version }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-left ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-left"
					>
						<ion-label>{{ appVersion }}</ion-label>
					</ion-item>
				</ion-card-content>
			</ion-card>

			<ion-card>
				<ion-card-header class="settings-label">
					<ion-card-title
						data-translate="help_us_improve"
						class="ion-text-center ion-text-uppercase"
					>
						{{ labels.help_us_improve }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-left ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-left"
					>
						<ion-toggle
							data-translate="collect_errors"
							@ionChange="updateCollectErrors($event)"
							class="ion-text-wrap"
							color="secondary"
							:checked="state.collectErrors"
						>
							{{ labels.collect_errors }}
						</ion-toggle>
					</ion-item>
				</ion-card-content>
			</ion-card>

			<ion-card v-if="isDebug || hasEasterEggProject">
				<ion-card-header class="settings-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.advanced_settings }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-center ion-no-padding">
					<ion-item>
						<ion-label color="dark">{{ labels.server_url }}
						</ion-label>
					</ion-item>
					<ion-item lines="none">
						<input
							class="full-width"
							type="text"
							v-model="state.serverUrl"
						/>
					</ion-item>
				</ion-card-content>
			</ion-card>

		</template>
	</base-layout>
</template>

<script>
import { chevronBackOutline, add, remove, checkmark } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import { useBackButton } from '@ionic/vue';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { notificationService } from '@/services/notification-service';
import { rollbarService } from '@/services/utilities/rollbar-service';

export default {
	components: {},
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			serverUrl: rootStore.serverUrl,
			selectedTextSize: rootStore.selectedTextSize,
			collectErrors: rootStore.collectErrors,
			isSaving: false
		});
		const zoomLevels = PARAMETERS.ZOOM_LEVELS;

		const computedScope = {
			appVersion: computed(() => {
				return rootStore.app.name + ' v ' + rootStore.app.version;
			}),
			isDebug: computed(() => {
				return PARAMETERS.DEBUG;
			}),
			hasEasterEggProject: computed(() => {
				return rootStore.easterEgg;
			})
		};

		const methods = {
			goBack() {
				router.replace({
					name: rootStore.nextRoute,
					query: { ...rootStore.routeParams }
				});
			},
			async saveSettings() {
				let failed = false;
				await notificationService.showProgressDialog();
				state.isSaving = true;
				//change zoom level
				//remove any zoom class
				for (let i = 0; i <= zoomLevels; i++) {
					document.body.classList.remove('zoom-' + i);
				}
				//add selected zoom level class
				document.body.classList.add('zoom-' + state.selectedTextSize);

				//update db
				Object.values(PARAMETERS.SETTINGS_KEYS).forEach(async (key) => {
					console.log(key);

					switch (key) {
						case PARAMETERS.SETTINGS_KEYS.SERVER_URL:
							try {
								// Remove trailing slash
								const trimmedUrl = state.serverUrl.replace(/\/$/, '');
								await databaseInsertService.insertSetting(key, trimmedUrl);
								rootStore.serverUrl = trimmedUrl;
							} catch (error) {
								console.log(error);
								failed = true;
							}
							break;
						case PARAMETERS.SETTINGS_KEYS.SELECTED_TEXT_SIZE:
							try {
								await databaseInsertService.insertSetting(key, state.selectedTextSize);
								rootStore.selectedTextSize = state.selectedTextSize;
							} catch (error) {
								console.log(error);
								failed = true;
							}
							break;
						case PARAMETERS.SETTINGS_KEYS.COLLECT_ERRORS:

							try {
								await databaseInsertService.insertSetting(key, state.collectErrors);
								rootStore.collectErrors = state.collectErrors;
							} catch (error) {
								console.log(error);
								failed = true;
							}
							break;
					}
				});

				notificationService.hideProgressDialog();
				state.isSaving = false;
				if (failed) {
					notificationService.showAlert(labels.unknown_error, labels.error);
				} else {
					notificationService.showToast(STRINGS[language].status_codes.ec5_123);
				}
			},
			updateSelectedTextSize(e) {
				state.selectedTextSize = e.detail.value;
				rootStore.selectedTextSize = state.selectedTextSize;
			},
			updateCollectErrors(e) {
				state.collectErrors = e.detail.checked;
				rootStore.collectErrors = state.collectErrors;
				console.log('Rollbar reporting ->', rootStore.collectErrors);
				rollbarService.configure({ enabled: Boolean(rootStore.collectErrors) });
			}
		};

		onMounted(() => {
			console.log('Component Settings is mounted!');
		});

		//back to projects list with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isSaving) {
				methods.goBack();
			}
		});

		return {
			labels,
			...methods,
			...computedScope,
			state,
			zoomLevels,
			//icons
			chevronBackOutline,
			add,
			remove,
			checkmark
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>