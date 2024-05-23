<template>
	<ion-card class="login-default">
		<ion-card-content class="ion-no-padding">
			<ion-grid>
				<ion-row v-if="isGoogleAuthEnabled || isDebug">
					<ion-col>
						<div class="ion-text-center">
							<img
								:src="getGoogleSigninButtonImage()"
								width="210"
								height="50"
								@click="performLoginGoogle()"
							/>
						</div>
					</ion-col>
				</ion-row>
				<ion-row v-if="isAppleAuthEnabled || isDebug">
					<ion-col>
						<div class="ion-text-center">
							<img
								:src="getAppleSigninButtonImage()"
								width="210"
								height="50"
								@click="performLoginApple()"
							/>
						</div>
					</ion-col>
				</ion-row>
				<ion-row v-if="(isPasswordlessAuthEnabled && (isAppleAuthEnabled || isGoogleAuthEnabled)) || isDebug">
					<ion-col>
						<div class="hr-divider-wrapper">
							<span class="hr-divider">{{ labels.or }}</span>
						</div>
					</ion-col>
				</ion-row>
				<ion-row v-if="isPasswordlessAuthEnabled || isDebug">
					<ion-col>
						<div class="ion-text-center">
							<ion-button
								class="email-login-btn ion-text-nowrap"
								mode="md"
								fill="outline"
								size="default"
								color="dark"
								@click="openModalPasswordlessSend()"
							>
								<img
									slot="start"
									:src="getEmailSigninButtonImage()"
									width="24"
									height="24"
								/>
								&nbsp;
								{{ labels.login_with_email }}
							</ion-button>
						</div>
					</ion-col>
				</ion-row>
			</ion-grid>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import ModalPasswordlessSend from '@/components/modals/ModalPasswordlessSend';
import { authGoogleService } from '@/services/auth/auth-google-service';
import { authAppleService } from '@/services/auth/auth-apple-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export default {
	props: {
		authMethods: {
			type: Array,
			required: true
		},
		authIds: {
			type: Object,
			required: true
		}
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
			showAppleSignIn: false
		});

		//show Apple sign in only on iOS 13+
		if (rootStore.device.platform === PARAMETERS.IOS) {
			if (parseInt(rootStore.device.osVersion) >= 13) {
				state.showAppleSignIn = true;
			} else {
				state.showAppleSignIn = false;
			}
		} else {
			state.showAppleSignIn = false;
		}

		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			getGoogleSigninButtonImage() {
				return PARAMETERS.GOOGLE_SIGNIN_BUTTON_IMAGE;
			},
			getAppleSigninButtonImage() {
				return PARAMETERS.APPLE_SIGNIN_BUTTON_IMAGE;
			},
			getEmailSigninButtonImage() {
				return PARAMETERS.EMAIL_SIGNIN_BUTTON_IMAGE;
			},
			async openModalPasswordlessSend() {
				modalsHandlerService.passwordlessSend = await modalController.create({
					cssClass: 'modal-passwordless-send',
					component: ModalPasswordlessSend,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {}
				});

				modalsHandlerService.passwordlessSend.onDidDismiss().then((response) => {
					console.log('is ModalPasswordlessSend', response.data);
				});

				return modalsHandlerService.passwordlessSend.present();
			},
			/**
			 * Send user to native google sign in page
			 * Afterwards, we retrieve the access_code, submit it to our server
			 * Exchanging it for an access_token and returning a jwt
			 */
			async performLoginGoogle() {
				const { authIds } = props;
				authGoogleService.authGoogleUser(authIds);
			},
			async performLoginApple() {
				authAppleService.authAppleUser();
			}
		};

		const computedScope = {
			isDebug: computed(() => {
				return PARAMETERS.DEBUG;
			}),
			isAppleAuthEnabled: computed(() => {
				return props.authMethods.includes(PARAMETERS.PROVIDERS.APPLE) && state.showAppleSignIn;
			}),
			isGoogleAuthEnabled: computed(() => {
				if (rootStore.hasGoogleServices) {
					return props.authMethods.includes(PARAMETERS.PROVIDERS.GOOGLE);
				} else {
					return false;
				}
			}),
			isPasswordlessAuthEnabled: computed(() => {
				return props.authMethods.includes(PARAMETERS.PROVIDERS.PASSWORDLESS);
			})
		};

		return {
			labels,
			state,
			...computedScope,
			...methods
		};
	}
};
</script>

<style
	lang="scss"
	scoped
>
.hr-divider {
	display: flex;
	flex-basis: 100%;
	align-items: center;
	color: #333;
	margin: 8px 0px;
}

.hr-divider:before,
.hr-divider:after {
	content: "";
	flex-grow: 1;
	background: #333;
	height: 1px;
	font-size: 0px;
	line-height: 0px;
	margin: 0px 8px;
}

.hr-divider-wrapper {
	max-width: 210px;
	margin: 0 auto;
}
</style>