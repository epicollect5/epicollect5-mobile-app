<template>
	<div v-if="item.type==='readme'">
		<div v-html="item.question"></div>
	</div>
	<div v-else-if="item.type==='location'">
		<answer-location :item="item"></answer-location>
	</div>
	<div v-else-if="item.type==='branch'">
		{{item.answer}}
	</div>
	<div v-else-if="item.type==='group'">
		<answer-group
			:formRef="formRef"
			:entry="entry"
			:errors="errors"
			:item="item"
		>
		</answer-group>
	</div>
	<div
		v-else
		class="answer-item-text"
	>
		<span>{{item.answer}}</span>
	</div>
	<div
		v-if="item.synced_error && item.type !=='group'"
		class="answer-error"
	>
		<span>{{ item.synced_error }}</span>
	</div>
</template>

<script>
import AnswerLocation from '@/components/answers/AnswerLocation.vue';
import AnswerGroup from '@/components/answers/AnswerGroup.vue';

export default {
	name: 'ListItemAnswer',
	components: {
		AnswerLocation,
		AnswerGroup
	},
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
		},
		areGroupAnswers: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const methods = {
			editEntry() {
				// todo: emit event to parent
			}
		};

		return {
			...props,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>