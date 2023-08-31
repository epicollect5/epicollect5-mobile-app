<template>
	<ion-header class="ion-no-border">
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
				<ion-button
					data-test="share"
					v-if="!isPWA"
					@click="share()"
				>
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
		<swiper
			:modules="sliderModules"
			:zoom="true"
		>
			<swiper-slide>
				<div class="swiper-zoom-container">
					<ion-spinner
						data-test="spinner"
						class="spinner ion-margin-top"
						v-show="!state.imageLoaded"
						name="crescent"
					></ion-spinner>
					<img
						:src="imageSource"
						@load="onImageLoad()"
					>
				</div>
			</swiper-slide>
		</swiper>
	</ion-content>
</template>

<script>
import { reactive } from '@vue/reactivity';
import { IonicSlides } from '@ionic/vue';
import { modalController } from '@ionic/vue';
import { Share } from '@capacitor/share';
import { shareSocialSharp, closeOutline } from 'ionicons/icons';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Zoom } from 'swiper';
import 'swiper/css';
import '@ionic/vue/css/ionic-swiper.css';
import 'swiper/css/zoom';

export default {
	components: { Swiper, SwiperSlide },
	props: {
		imageSource: {
			type: String,
			required: true
		},
		fileSource: {
			type: String,
			required: true
		},
		isPWA: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const sliderModules = [Zoom, IonicSlides];
		const state = reactive({
			imageLoaded: false
		});
		const methods = {
			dismiss() {
				modalController.dismiss();
			},
			share() {
				Share.share({
					title: '',
					text: '',
					//this works in ios 14+
					url: 'file://' + props.fileSource,
					dialogTitle: ''
				});
			},
			onImageLoad() {
				state.imageLoaded = true;
			}
		};

		return {
			...props,
			state,
			sliderModules,
			...methods,
			//icons
			shareSocialSharp,
			closeOutline
		};
	}
};
</script>

<style lang="scss" scoped></style>