<template>
	<ion-grid class="question-label-grid">
		<ion-row>
			<ion-col
				size-xs="10"
				size-sm="11"
				size-md="11"
				size-lg="11"
				size-xl="11"
			>
				<div class="">{{questionText}}</div>
			</ion-col>
			<ion-col
				size-xs="2"
				size-sm="1"
				size-md="1"
				size-lg="1"
				size-xl="1"
			>
				<div class="question-label-button ion-activatable ripple-parent ion-text-center">
					<ion-icon
						:icon="filter"
						@click="openModalPossibleAnswers()"
					></ion-icon>
					<ion-ripple-effect
						class="question-label-button-ripple"
						type="unbounded"
					></ion-ripple-effect>
				</div>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
import { STRINGS } from '@/config/strings';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { readonly, toRefs } from '@vue/reactivity';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import ModalPossibleAnswers from '@/components/modals/ModalPossibleAnswers';
import { PARAMETERS } from '@/config';

export default {
	props: {
		questionText: {
			type: String,
			required: true
		},
		questionType: {
			type: String,
			required: true
		},
		possibleAnswers: {
			type: Array,
			required: true
		},
		selectedAnswers: {
			type: Array,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		}
	},
	emit: ['on-selected-answers'],
	setup(props, context) {
		const rootStore = useRootStore();
		const { questionType, possibleAnswers, isGroupInput } = readonly(props);
		const { selectedAnswers } = toRefs(props);
		const language = rootStore.language;
		const scope = {};
		const methods = {
			async openModalPossibleAnswers() {
				await services.notificationService.showProgressDialog(STRINGS[language].labels.wait);
				scope.ModalPossibleAnswers = await modalController.create({
					cssClass: 'modal-search',
					component: ModalPossibleAnswers,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						selectedAnswers: selectedAnswers.value,
						isGroupInput,
						questionType,
						possibleAnswers: possibleAnswers
					}
				});

				scope.ModalPossibleAnswers.onWillDismiss().then((response) => {
					console.log('is', response.data);
					//get selected answer(s) from modal
					//always emit response as array
					context.emit('on-selected-answers', response.data);
				});

				scope.ModalPossibleAnswers.present().then(
					setTimeout(() => {
						services.notificationService.hideProgressDialog();
					}, PARAMETERS.DELAY_FAST)
				);
			}
		};

		return {
			...icons,
			...props,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>