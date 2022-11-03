<template>
	<ion-header>
		<ion-toolbar>
			<ion-buttons slot="start">
				<ion-button @click="dismiss()">
					<ion-icon
						slot="icon-only"
						:icon="closeOutline"
					>
					</ion-icon>
				</ion-button>
			</ion-buttons>
			<ion-buttons slot="end">
				<ion-button @click="share()">
					<ion-icon
						slot="icon-only"
						:icon="shareSocialSharp"
					>
					</ion-icon>
				</ion-button>
			</ion-buttons>
		</ion-toolbar>
	</ion-header>
	<ion-content>
		<ion-slides :options="sliderOptions">
			<ion-slide>
				<div class="swiper-zoom-container">
					<img :src="imageSource">
				</div>
			</ion-slide>
		</ion-slides>
	</ion-content>
	<ion-footer>
	</ion-footer>
</template>

<script>
import { modalController } from '@ionic/vue';
import { Share } from '@capacitor/share';
import { shareSocialSharp, closeOutline } from 'ionicons/icons';

export default {
	props: {
		imageSource: {
			type: String,
			required: true
		},
		fileSource: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const sliderOptions = {
			zoom: true
		};

		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			share() {
				Share.share({
					title: '',
					text: '',
					//this works in ios 14
					url: 'file://' + props.fileSource,
					dialogTitle: ''
				});
			}
		};
		return {
			...props,
			sliderOptions,
			...methods,
			//icons
			shareSocialSharp,
			closeOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>