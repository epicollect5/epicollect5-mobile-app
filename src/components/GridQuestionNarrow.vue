<template>
	<ion-grid class="ion-no-padding">
		<ion-row>
			<ion-col
				size-xs="8"
				offset-xs="2"
				size-sm="6"
				offset-sm="3"
				size-md="4"
				offset-md="4"
				size-lg="4"
				offset-lg="4"
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