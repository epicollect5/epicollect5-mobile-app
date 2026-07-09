<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content class="animate__animated animate__fadeIn">

		<card-login-default
			:authMethods="authMethods"
			:authIds="authIds"
		>
		</card-login-default>

		<card-login-local v-if="isLocalAuthEnabled"></card-login-local>

		<card-login-ldap v-if="isLdpaAuthEnabled"></card-login-ldap>

	</ion-content>
</template>

<script>
import { computed, reactive } from 'vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import HeaderModal from '@/components/ui/HeaderModal.vue';
import CardLoginLocal from '@/components/auth/CardLoginLocal.vue';
import CardLoginLdap from '@/components/auth/CardLoginLdap.vue';
import CardLoginDefault from '@/components/auth/CardLoginDefault.vue';

export default {
	components: { HeaderModal, CardLoginLocal, CardLoginLdap, CardLoginDefault },
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
		const state = reactive({});

		const methods = {
			dismiss() {
				modalController.dismiss();
			}
		};

		const computedScope = {
			isDebug: computed(() => {
				return PARAMETERS.DEBUG;
			}),
			isLocalAuthEnabled: computed(() => {
				return props.authMethods.includes(PARAMETERS.PROVIDERS.LOCAL);
			}),
			isLdpaAuthEnabled: computed(() => {
				return props.authMethods.includes(PARAMETERS.PROVIDERS.LDAP);
			})
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>
