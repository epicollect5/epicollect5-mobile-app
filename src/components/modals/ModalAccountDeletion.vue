<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-toolbar color="danger">
			<ion-title class="ion-text-center">{{ labels.delete_account }}</ion-title>
		</ion-toolbar>

		<ion-card class="login-confirm-email">
			<ion-card-content class="ion-no-padding">
				<ion-grid>
					<ion-row>
						<ion-col>
							<ion-item-group>
								<ion-card color="warning">
									<ion-card-content>
										<ion-label
											color="dark"
											class="ion-text-wrap"
										>
											{{ labels.account_email_confirm_before }}
										</ion-label>
										<ion-label color="dark">
											<strong>{{ email }}</strong>
										</ion-label>
										<ion-label
											color="dark"
											class="ion-text-wrap"
										>
											{{ labels.account_email_confirm_after }}
										</ion-label>
									</ion-card-content>
								</ion-card>

								<ion-card color="light">
									<ion-card-content>
										{{ labels.account_deletion_team_will_contact }}
									</ion-card-content>
								</ion-card>

								<ion-grid>
									<ion-row>
										<ion-col class="ion-text-left">
											<ion-button
												color="light"
												@click="dismiss()"
											> {{ labels.dismiss }}</ion-button>
										</ion-col>
										<ion-col class="ion-text-right">
											<ion-button
												color="danger"
												@click="onConfirm()"
											>{{ labels.confirm }}</ion-button>
										</ion-col>
									</ion-row>
								</ion-grid>

							</ion-item-group>

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
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import HeaderModal from '@/components/HeaderModal.vue';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { showModalLogin } from '@/use/show-modal-login';
import { logout } from '@/use/logout';
import { useRouter } from 'vue-router';

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
		const router = useRouter();
		const state = reactive({});
		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			async onConfirm() {
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					//show error to user
					notificationService.showAlert(STRINGS[language].status_codes['ec5_118']);
				}
				await notificationService.showProgressDialog(labels.wait);
				try {
					const response = await webService.requestAccountDeletion();
					if (response.data.data.accepted) {
						//show toast
						notificationService.showAlert(labels.account_deletion_request_sent);
						//redirect to projects page
						router.replace({
							name: PARAMETERS.ROUTES.PROJECTS
						});
						return;
					}

					if (response.data.data.deleted) {
						//log user out
						await logout();
						//show user confirmation		
						notificationService.showAlert(STRINGS[language].status_codes.ec5_385);
						// //redirect to projects page
						// router.replace({
						// 	name: PARAMETERS.ROUTES.PROJECTS
						// });
						return;
					}
					//show error
					notificationService.showAlert(STRINGS[language].status_codes['ec5_116']);
				} catch (error) {
					//show error
					if (error.data?.errors[0]?.code === 'ec5_219') {
						//jwt token expired?, logout and show login modal
						const expired = await utilsService.isJWTExpired();
						if (expired) {
							await logout();
							showModalLogin();
						} else {
							//handle general error
							await errorsService.handleWebError(error);
						}
					} else {
						//handle general error
						await errorsService.handleWebError(error);
					}
				} finally {
					methods.dismiss();
					notificationService.hideProgressDialog();
					router.replace({
						name: PARAMETERS.ROUTES.PROJECTS
					});
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