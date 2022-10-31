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
import * as icons from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { menuController, modalController } from '@ionic/vue';
import * as services from '@/services';
import { PARAMETERS } from '@/config';
import ModalPasswordlessSend from '@/components/modals/ModalPasswordlessSend';
import HeaderModal from '@/components/HeaderModal.vue';
import CardLoginLocal from '@/components/CardLoginLocal';
import CardLoginLdap from '@/components/CardLoginLdap.vue';
import CardLoginDefault from '@/components/CardLoginDefault.vue';

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
			...icons,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
ion-content {
	--background: transparent;
}
ion-header {
	ion-toolbar {
		--background: transparent;
		ion-button,
		ion-icon {
			color: #333;
		}
	}
}
</style>