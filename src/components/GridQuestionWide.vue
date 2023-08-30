<template>
	<ion-grid class="ion-no-padding">
		<ion-row>
			<ion-col
				size-xs="12"
				offset-xs="0"
				size-sm="8"
				offset-sm="2"
				size-md="6"
				offset-md="3"
				size-lg="6"
				offset-lg="3"
				class="ion-align-self-center"
			>
				<slot></slot>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
export default {
	setup() {
		return {};
	}
};
</script>

<style lang="scss" scoped></style>