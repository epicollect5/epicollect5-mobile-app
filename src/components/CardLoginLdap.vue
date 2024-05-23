<template>
	<ion-card
		class="login-ldap"
		v-if="isDebug"
	>
		<ion-card-header class="question-label ion-text-center">
			<ion-card-title>LDAP Staff</ion-card-title>
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
									v-model.trim="state.authLdapCredentials.email"
								></ion-input>
							</ion-item>
							<ion-item lines="full">
								<ion-input
									type="password"
									:placeholder="labels.password"
									v-model.trim="state.authLdapCredentials.password"
								></ion-input>
							</ion-item>
							<ion-item lines="none">
								<div class="center-item-content-wrapper ion-padding-top ion-padding-bottom">
									<ion-button
										class="local-login-btn ion-text-nowrap"
										expand="full"
										mode="md"
										size="default"
										color="secondary"
										type="submit"
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
import { eye } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';

import { useRootStore } from '@/stores/root-store';
export default {
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = reactive({
			account: {
				email: '',
				provider: null,
				code: null
			},
			authLdapCredentials: {},
			eyeIcon: eye,
			authLdapInputPasswordType: 'password'
		});

		const computedScope = {
			isDebug: computed(() => {
				return PARAMETERS.DEBUG;
			})
		};

		return {
			labels,
			state,
			...computedScope,
			//icons
			eye
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>