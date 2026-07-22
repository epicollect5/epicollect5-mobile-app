<template>
	<div class="example-component">
		<!--
			No inline logic in templates.
			No inline arrow functions. Bind to methods/computedScope only.
		-->
		<ion-item
			v-for="item in state.items"
			:key="item.uuid"
			@click="selectItem(item)"
		>
			<ion-label>{{ itemTitle(item) }}</ion-label>
		</ion-item>

		<p v-if="computedScope.hasItems">{{ labels.items_found }}</p>
		<p v-else>{{ labels.no_items_found }}</p>
	</div>
</template>

<script>
import { reactive, computed, readonly, toRefs } from 'vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

export default {
	name: 'ExampleComponent',
	props: {
		items: {
			type: Array,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		// state -> single reactive container, NEVER spread in the return
		const state = reactive({
			selectedUuid: null
		});

		// props are read-only; destructure with toRefs when needed
		const { items } = readonly(props);
		const { items: itemsRef } = toRefs(props);

		const methods = {
			selectItem(item) {
				state.selectedUuid = item.uuid;
			},
			itemTitle(item) {
				return item.title || labels.untitled;
			}
		};

		// computedScope -> all derived values live here, never inline in template
		const computedScope = {
			hasItems: computed(() => itemsRef.value.length > 0)
		};

		return {
			state,
			labels,
			...methods,
			...computedScope
		};
	}
};
</script>

<!--
	Styles live in a separate scss file mirrored 1:1 from the component path.
	Path: src/theme/components/ExampleComponent.scss
-->
<style src="@/theme/components/ExampleComponent.scss" lang="scss"></style>
