<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-toolbar color="dark">
			<ion-title class="ion-text-center">{{ labels.login_with_email }}</ion-title>
		</ion-toolbar>

		<ion-card class="login-passwordless">
			<ion-card-content class="ion-no-padding">
				<ion-grid>
					<ion-row>
						<ion-col>
							<form>
								<ion-item lines="full">
									<ion-input
										type="email"
										inputmode="email"
										:placeholder="labels.email"
										required="true"
										v-model.trim="state.authPasswordlessCredentials.email"
									></ion-input>
								</ion-item>
								<ion-item lines="none">
									<div class="center-item-content-wrapper">
										<ion-label>
											<small>{{ labels.passwordless_teaser }}</small>
										</ion-label>
									</div>
								</ion-item>
								<ion-item
									lines="none"
									class="passwordless-send-item"
								>
									<div
										class="ion-padding-top ion-padding-bottom"
										slot="end"
									>
										<ion-button
											class="passwordless-send-btn ion-text-nowrap"
											mode="md"
											size="default"
											color="secondary"
											:disabled="state.authPasswordlessCredentials.email === ''"
											@click="requestPasswordlessCode()"
										>
											{{ labels.send }}
										</ion-button>
									</div>
								</ion-item>
							</form>
						</ion-col>
					</ion-row>
				</ion-grid>
			</ion-card-content>
		</ion-card>
	</ion-content>
	<ion-footer>
	</ion-footer>
</template>

<script>
import { modalController } from '@ionic/vue';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { readonly } from 'vue';
import ModalPasswordlessLogin from '@/components/modals/ModalPasswordlessLogin';
import HeaderModal from '@/components/HeaderModal.vue';
import { notificationService } from '@/services/notification-service';
import { authPasswordlessService } from '@/services/auth/auth-passwordless-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export default {
	components: {
		HeaderModal
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			account: {
				email: '',
				provider: null,
				code: null
			},
			// Available auth methods
			authMethods: [],
			// Auth method specific ids ie google CLIENT_ID
			authPasswordlessCredentials: {
				email: ''
			}
		});
		const scope = {};
		const methods = {
			dismiss() {
				modalsHandlerService.passwordlessSend.dismiss();
			},
			async requestPasswordlessCode() {
				const email = readonly(state.authPasswordlessCredentials.email);
				authPasswordlessService.getCode(email).then(
					async () => {
						//open modal to enter code
						modalsHandlerService.passwordlessLogin = await modalController.create({
							cssClass: 'modal-passwordless-login',
							component: ModalPasswordlessLogin,
							showBackdrop: true,
							backdropDismiss: false,
							componentProps: {
								email: state.authPasswordlessCredentials.email
							}
						});

						modalsHandlerService.passwordlessLogin.onDidDismiss().then((response) => {
							console.log('is', response.data);
							//when user is logged in, close all modals
							if (response?.data?.closeAllModals) {
								//todo:
								modalController.dismiss({ closeAllModals: true });
							}
						});
						modalsHandlerService.passwordlessLogin.present();
					},
					(errorCode) => {
						//show error to user
						notificationService.showAlert(STRINGS[language].status_codes[errorCode]);
					}
				);
			}
		};
		return {
			labels,
			state,
			...methods
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>