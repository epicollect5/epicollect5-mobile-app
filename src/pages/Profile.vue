<template>
	<base-layout title="">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
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
						{{ labels.profile }}
					</ion-label>
				</div>
			</ion-toolbar>
			<ion-card>
				<ion-card-header class="settings-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.name }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-left ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-left"
					>
						<ion-label>{{ user.name }}</ion-label>
					</ion-item>
				</ion-card-content>
			</ion-card>
			<ion-card>
				<ion-card-header class="settings-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.email }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-left ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-left"
					>
						<ion-label>{{ user.email }}</ion-label>
					</ion-item>
				</ion-card-content>
			</ion-card>
			<ion-card>
				<ion-card-header class="danger-label">
					<ion-card-title class="ion-text-center ion-text-uppercase">
						{{ labels.danger }}
					</ion-card-title>
				</ion-card-header>
				<ion-card-content class="ion-text-center ion-no-padding">
					<ion-item
						lines="none"
						class="ion-text-center"
					>
						<ion-label>

							<ion-button
								class="ion-text-nowrap"
								size="default"
								color="danger"
								@click="openModalAccountDeletion()"
							>
								<ion-icon :icon="nuclear"></ion-icon>
								&nbsp;
								{{ labels.delete_account }}
							</ion-button>
						</ion-label>
					</ion-item>
				</ion-card-content>
			</ion-card>

		</template>
	</base-layout>
</template>

<script>
import { nuclear, chevronBackOutline, add, remove, checkmark } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { useBackButton } from '@ionic/vue';
import ModalAccountDeletion from '@/components/modals/ModalAccountDeletion';
import { modalController } from '@ionic/vue';

export default {
	components: {},
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({});

		const computedScope = {
			user: computed(() => {
				return rootStore.user;
			})
		};
		const scope = {};

		const methods = {
			goBack() {
				console.log(rootStore.nextRoute);
				router.replace({
					name: rootStore.nextRoute,
					params: { ...rootStore.routeParams }
				});
			},
			async openModalAccountDeletion() {
				scope.ModalAccountDeletion = await modalController.create({
					cssClass: 'modal-account-deletion',
					component: ModalAccountDeletion,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						email: rootStore.user.email
					}
				});

				scope.ModalAccountDeletion.onDidDismiss().then((response) => { });
				return scope.ModalAccountDeletion.present();
			}
		};

		onMounted(() => {
			console.log('Component Profile is mounted!');
		});

		//back to projects list with back button (Android)
		useBackButton(10, () => {
			methods.goBack();
		});

		return {
			labels,
			...methods,
			...computedScope,
			state,
			//icons
			chevronBackOutline,
			add,
			remove,
			checkmark,
			nuclear
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>