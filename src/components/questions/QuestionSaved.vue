<template>
	<ion-card class="question-card animate__animated animate__fadeIn">
		<ion-card-header class="ion-text-center">
			<ion-card-title v-if="state.saved">{{labels.entry_completed}}</ion-card-title>
			<ion-card-title v-if="state.failed">{{labels.has_errors}}</ion-card-title>
		</ion-card-header>
		<ion-card-content
			v-if="showAddEntryButton || state.failed"
			class="ion-text-center"
		>
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
							v-if="state.saved"
							class="question-action-button"
							color="secondary"
							expand="block"
							@click="addEntry()"
						>
							<ion-icon
								slot="start"
								:icon="addOutline"
							></ion-icon>
							{{labels.add_entry}}
						</ion-button>

						<ion-button
							v-if="state.failed"
							class="question-action-button"
							color="danger"
							expand="block"
							@click="goBack()"
						>
							<ion-icon
								slot="start"
								:icon="arrowBackOutline"
							></ion-icon>
							{{labels.back}}
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
import { addOutline, arrowBackOutline } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { PARAMETERS } from '@/config';

export default {
	props: {
		type: {
			type: String,
			required: true
		},
		saved: {
			type: Boolean,
			required: true
		},
		failed: {
			type: Boolean,
			required: true
		},
		action: {
			type: String,
			required: true
		}
	},
	emits: ['question-mounted', 'add-entry-pwa', 'go-back-pwa'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const entriesAddState = inject('entriesAddState');
		const state = reactive({
			saved: props.saved,
			failed: props.failed,
			action: props.action
		});

		onMounted(async () => {
			console.log('Component Question is mounted, type -> SAVE');
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		const methods = {
			addEntry() {
				context.emit('add-entry-pwa');
			},
			goBack() {
				context.emit('go-back-pwa');
			}
		};

		const computedScope = {
			showAddEntryButton: computed(() => {
				return rootStore.entriesAddScope.entryService.action === PARAMETERS.ENTRY_ADD;
			})
		};

		return {
			labels,
			entriesAddState,
			state,
			...computedScope,
			...methods,
			//icons
			addOutline,
			arrowBackOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>