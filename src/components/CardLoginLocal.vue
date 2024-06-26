<template>
	<ion-card class="login-local">
		<ion-card-header class="question-label ion-text-center">
			<ion-card-title>CGPS Staff</ion-card-title>
		</ion-card-header>
		<ion-card-content class="ion-no-padding">
			<ion-grid>
				<ion-row>
					<ion-col>
						<form>
							<ion-item lines="full">
								<ion-input
									type="email"
									:placeholder="labels.email"
									required="true"
									v-model.trim="state.authLocalCredentials.email"
								></ion-input>
							</ion-item>
							<ion-item lines="full">
								<ion-input
									slot="start"
									:type="state.authLocalInputPasswordType"
									:placeholder="labels.password"
									required="true"
									v-model.trim="state.authLocalCredentials.password"
								></ion-input>
								<ion-icon
									slot="end"
									:icon="state.eyeIcon"
									@click="toggleInputType()"
								></ion-icon>
							</ion-item>
							<ion-item lines="none">
								<div class="center-item-content-wrapper ion-padding-top ion-padding-bottom">
									<ion-button
										class="local-login-btn ion-text-nowrap"
										expand="full"
										mode="md"
										size="default"
										color="secondary"
										:disabled="areAuthLocalCredentialsEmpty"
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

</template>

<script>
import { eye, eyeOff } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { menuController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { loginLocal } from '@/use/login-local';

export default {
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
			authLocalCredentials: {
				email: '',
				password: ''
			},
			eyeIcon: eye,
			authLocalInputPasswordType: 'password'
		});

		const methods = {
			async performLoginLocal() {
				menuController.close();
				//attempt to login local user
				loginLocal(state.authLocalCredentials);
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

		const computedScope = {
			isDebug: computed(() => {
				return PARAMETERS.DEBUG;
			}),
			areAuthLocalCredentialsEmpty: computed(() => {
				return (
					state.authLocalCredentials.email === '' || state.authLocalCredentials.password === ''
				);
			})
		};

		return {
			labels,
			state,
			...computedScope,

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