<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-toolbar color="dark">
			<ion-title class="ion-text-center">{{ labels.account_exists }}</ion-title>
		</ion-toolbar>

		<ion-card class="login-passowrd-confirm">
			<ion-card-content class="ion-no-padding">
				<ion-grid>
					<ion-row>
						<ion-col>

							<ion-item-group>
								<div class="center-item-content-wrapper">
									<ion-label color="dark">
										<strong>{{ email }}</strong>
									</ion-label>
									<ion-label color="dark">
										{{ labels.enter_password }}
									</ion-label>
								</div>
							</ion-item-group>

							<form>
								<ion-item lines="full">
									<ion-input
										slot="start"
										:type="state.authLocalInputPasswordType"
										:placeholder="labels.password"
										required="true"
										v-model.trim="state.password"
									></ion-input>
									<ion-icon
										slot="end"
										:icon="state.eyeIcon"
										@click="toggleInputType()"
									></ion-icon>
								</ion-item>

								<ion-item
									lines="none"
									class="password-confirm-item"
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
											:disabled="state.password.length === 0"
											@click="performLoginLocal()"
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
import { eye, eyeOff } from 'ionicons/icons';
import { modalController } from '@ionic/vue';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { readonly } from 'vue';
import { loginLocal } from '@/use/login-local';
import HeaderModal from '@/components/HeaderModal.vue';

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

		const state = reactive({
			password: '',
			eyeIcon: eye,
			authLocalInputPasswordType: 'password'
		});
		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			async performLoginLocal() {
				const { email } = readonly(props);
				//attempt to login local user
				loginLocal({ email, password: state.password });
			},
			toggleInputType() {
				if (state.eyeIcon === eye) {
					state.eyeIcon = eyeOff;
					state.authLocalInputPasswordType = 'text';
				} else {
					state.eyeIcon = eye;
					state.authLocalInputPasswordType = 'password';
				}
			}
		};
		return {
			labels,
			state,
			...props,
			...methods,
			//icons
			eye,
			eyeOff
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>