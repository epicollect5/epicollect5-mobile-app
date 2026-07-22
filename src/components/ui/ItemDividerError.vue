<template>
	<ion-item-divider
		color="danger"
		class="entry-error-global ion-text-center"
		sticky
	>
		<ion-label class="entry-title-label ion-text-center">
			{{ props.message }}
		</ion-label>
	</ion-item-divider>
</template>

<script>
export default {
	props: {
		message: {
			type: String,
			required: true
		}
	},
	setup(props) {
		return {
			props
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>