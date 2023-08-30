<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-toolbar color="dark">
			<ion-title
				data-translate="check_email"
				class="ion-text-center"
			>{{ labels.check_email }}</ion-title>
		</ion-toolbar>

		<ion-card class="login-confirm-email">
			<ion-card-content class="ion-no-padding">
				<ion-grid>
					<ion-row>
						<ion-col>
							<ion-item-group>
								<div class="center-item-content-wrapper">
									<ion-label
										data-translate="account_exists"
										color="dark"
									>
										{{ labels.account_exists }}
									</ion-label>
									<ion-label color="dark">
										<strong>{{ account.email }}</strong>
									</ion-label>
									<ion-label
										data-translate="code_was_sent"
										color="dark"
									>
										{{ labels.code_was_sent }}
									</ion-label>
								</div>
							</ion-item-group>

							<form>
								<ion-item lines="full">
									<ion-input
										inputmode="numeric"
										pattern="[0-9]*"
										v-model.trim="state.code"
										maxlength="6"
										minlength="6"
										:placeholder="labels.type_hint"
									>
									</ion-input>
								</ion-item>

								<ion-item
									lines="none"
									class="email-confirm-item"
								>
									<div
										class="ion-padding-top ion-padding-bottom"
										slot="end"
									>
										<ion-button
											data-test="login"
											data-translate="login"
											class="email-confirm-btn"
											mode="md"
											size="default"
											color="secondary"
											:disabled="state.code.length !== 6"
											@click="performUserVerification()"
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
import { authVerificationService } from '@/services/auth/auth-verification-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export default {
	components: {
		HeaderModal
	},
	props: {
		account: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { account } = readonly(props);

		const state = reactive({
			code: ''
		});
		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			async performUserVerification() {
				const credentials = {
					email: account.email,
					code: state.code,
					user: account.user,
					provider: account.provider
				};

				try {
					const response = await authVerificationService.verifyUser(credentials);
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
			...props,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped></style>