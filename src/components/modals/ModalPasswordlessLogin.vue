<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-toolbar color="dark">
			<ion-title class="ion-text-center">{{ labels.enter_code }}</ion-title>
		</ion-toolbar>

		<ion-card class="login-passwordless">
			<ion-card-content class="ion-no-padding">
				<ion-grid>
					<ion-row>
						<ion-col>
							<form>
								<ion-item lines="full">
									<ion-input
										inputmode="numeric"
										pattern="[0-9]*"
										v-model.trim="state.authPasswordlessCredentials.code"
										maxlength="6"
										minlength="6"
										:placeholder="labels.type_hint"
									>
									</ion-input>
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
											:disabled="state.authPasswordlessCredentials.code.length !== 6"
											@click="performPasswordlessLogin()"
										>
											{{ labels.login }}
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
import HeaderModal from '@/components/HeaderModal.vue';
import { notificationService } from '@/services/notification-service';
import { authPasswordlessService } from '@/services/auth/auth-passwordless-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export default {
	components: {
		HeaderModal
	},
	props: {
		email: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { email } = readonly(props);
		const state = reactive({
			authPasswordlessCredentials: {
				email,
				code: ''
			}
		});
		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			async performPasswordlessLogin() {
				const credentials = readonly(state.authPasswordlessCredentials);

				try {
					//try to auth user
					const response = await authPasswordlessService.authPasswordlessUser(credentials);
					//auth success, login user
					await authLoginService.loginUser(response);

					//dismiss all modals
					modalsHandlerService.dismissAll();

					//any extra action to perform? (like addProject()...)
					if (rootStore.afterUserIsLoggedIn.callback !== null) {
						const callback = rootStore.afterUserIsLoggedIn.callback;
						const params = rootStore.afterUserIsLoggedIn.params;
						if (params) {
							//async addProject()
							await callback(...params);
						} else {
							//async updateLocalProject()
							await callback();
						}
						//reset callback
						rootStore.afterUserIsLoggedIn = { callback: null, params: null };
					} else {
						notificationService.hideProgressDialog();
					}

					//show notification
					notificationService.showToast(STRINGS[language].status_codes.ec5_115);
				} catch (errorCode) {
					//show error to user
					notificationService.hideProgressDialog();
					notificationService.showAlert(STRINGS[language].status_codes[errorCode]);
				}
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