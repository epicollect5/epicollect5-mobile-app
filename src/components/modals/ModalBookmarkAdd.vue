<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content class="animate__animated animate__fadeIn">
		<ion-toolbar
			color="dark"
			mode="md"
			class="ion-text-center ion-text-uppercase"
		>
			<ion-title>{{labels.bookmark}}</ion-title>

		</ion-toolbar>
		<ion-grid>
			<ion-row>
				<ion-col
					size-xs="12"
					offset-xs="0"
					size-sm="8"
					offset-sm="2"
					size-md="8"
					offset-md="2"
				>
					<ion-card>
						<ion-card-header class="settings-label">
							<ion-card-title class="ion-text-center ion-text-uppercase">
								{{labels.bookmark_title}}
							</ion-card-title>
						</ion-card-header>
						<ion-card-content>

							<div class="ion-margin-top">
								<input
									type="text"
									class="question-input"
									:placeholder="labels.type_hint"
									v-model="state.bookmarkTitle"
									maxlength="50"
								/>
							</div>
							<div :class="bookmarkClass">
								{{labels.invalid_value}}
							</div>
							<ion-button
								expand="block"
								color="secondary"
								:disabled="state.bookmarkTitle.length === 0 || !isValidTitle"
								@click="addBookmark()"
							>
								<ion-icon
									slot="start"
									:icon="add"
								></ion-icon>
								{{labels.add_bookmark}}
							</ion-button>
						</ion-card-content>
					</ion-card>

				</ion-col>
			</ion-row>
		</ion-grid>
	</ion-content>

</template>

<script>
import { add } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { projectModel } from '@/models/project-model.js';
import HeaderModal from '@/components/HeaderModal.vue';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { notificationService } from '@/services/notification-service';

export default {
	components: { HeaderModal },
	props: {
		bookmarkTitle: {
			type: String,
			required: true
		},
		projectRef: {
			type: String,
			required: true
		},
		formRef: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const bookmarkStore = useBookmarkStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			bookmarkTitle: props.bookmarkTitle
		});

		const { projectRef, formRef } = readonly(props);
		const regex = new RegExp(PARAMETERS.REGEX_BOOKMARK_TITLE);

		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			async addBookmark() {
				try {
					const bookmarkId = await bookmarksService.insertBookmark(
						projectRef,
						formRef,
						state.bookmarkTitle
					);
					// Set current bookmark id
					bookmarkStore.bookmarkId = bookmarkId;

					notificationService.showToast(STRINGS[language].status_codes.ec5_126);
				} catch (error) {
					notificationService.showAlert(STRINGS[language].status_codes.ec5_104);
				}
				modalController.dismiss();
			}
		};

		const computedScope = {
			projectName: projectModel.getProjectName(),
			projectSmallDescription: projectModel.getSmallDescription(),
			projectDescription: projectModel.getDescription(),
			isValidTitle: computed(() => {
				return regex.test(state.bookmarkTitle);
			}),
			bookmarkClass: computed(() => {
				return {
					'bookmark-title-error': !regex.test(state.bookmarkTitle),
					'bookmark-title-success': regex.test(state.bookmarkTitle)
				};
			})
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			add
		};
	}
};
</script>

<style lang="scss" scoped>
</style>