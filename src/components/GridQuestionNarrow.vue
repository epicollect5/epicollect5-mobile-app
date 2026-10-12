<template>
	<ion-grid class="ion-no-padding">
		<ion-row>
			<ion-col
				:size-xs="wide ? 12 : 8"
				:offset-xs="wide ? 0 : 2"
				size-sm="6"
				offset-sm="3"
				size-md="4"
				offset-md="4"
				size-lg="4"
				offset-lg="4"
				class="ion-align-self-center"
			>
				<slot name="content"></slot>
			</ion-col>
		</ion-row>
	</ion-grid>
</template>

<script>
export default {
	props: {
		//date/time fields opt in: on phones (xs) the default 8/12 column is
		//too narrow for "hh:mm:ss AM/PM", which ellipsized inside the picker
		//button. Wider breakpoints keep the default column for consistency
		//with the other narrow questions.
		wide: {
			type: Boolean,
			default: false
		}
	},
	setup() {
		return {};
	}
};
</script>

<style src="@/theme/components/ui/GridQuestionNarrow.scss" lang="scss" scoped></style>
