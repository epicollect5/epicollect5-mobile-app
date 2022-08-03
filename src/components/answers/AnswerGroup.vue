<template>
	<list-answers
		class="answer-group"
		:items="item.answer"
		:formRef="formRef"
		:entry="entry"
		:errors="errors"
		:areGroupAnswers="true"
		:areBranchAnswers="false"
	>
	</list-answers>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

export default {
	props: {
		item: {
			type: Object,
			required: true
		},
		formRef: {
			type: String,
			required: true
		},
		entry: {
			type: Object,
			required: true
		},
		errors: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		return {
			labels,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>