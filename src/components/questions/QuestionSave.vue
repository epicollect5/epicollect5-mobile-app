<template>
	<ion-card class="question-card animate__animated animate__fadeIn">
		<ion-card-content class="ion-text-center">
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
						<ion-button
							v-if="!entriesAddState.questionParams.isBranch"
							class="question-action-button ion-text-nowrap"
							color="secondary"
							expand="block"
							@click="save()"
						>
							<ion-icon
								slot="start"
								:icon="isPWA ? cloudUpload : archive"
							></ion-icon>
							{{ labels.save_entry }}
						</ion-button>
						<ion-button
							v-if="entriesAddState.questionParams.isBranch"
							class="question-action-button ion-text-nowrap"
							color="secondary"
							expand="block"
							@click="save()"
						>
							<ion-icon
								slot="start"
								:icon="isPWA ? cloudUpload : archive"
							></ion-icon>
							{{ labels.save_branch_entry }}
						</ion-button>
					</ion-col>
				</ion-row>
			</ion-grid>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { archive, cloudUpload } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';

export default {
	props: {
		type: {
			type: String,
			required: true
		}
	},
	emits: ['question-mounted', 'question-save'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const entriesAddState = inject('entriesAddState');
		const state = reactive({
			inputDetails: {},
			currentInputRef: null,
			error: {
				errors: []
			},
			required: false,
			question: '',
			pattern: null,
			answer: {
				answer: '',
				was_jumped: false
			},
			confirmAnswer: {
				verify: false,
				answer: ''
			},
			fileSource: ''
		});

		onMounted(async () => {
			console.log('Component Question is mounted, type -> SAVE');
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		const methods = {
			save() {
				context.emit('question-save');
			}
		};
		const computedScope = {
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		return {
			labels,
			entriesAddState,
			state,
			...methods,
			...computedScope,
			//icons
			archive,
			cloudUpload
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>