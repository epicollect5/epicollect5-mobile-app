<template>
	<ion-list class="answer-list">
		<ion-card
			v-for="(item, index) in state.itemsChunk"
			:key="index"
			class="answer-card animate__animated animate__fadeIn"
		>
			<div>
				<ion-card-header
					v-if="item.type!=='readme'"
					class="answer-label force-no-padding"
					:class="item.synced_error ? 'has-error' : '' "
				>
					<ion-card-title>
						<ion-grid>
							<ion-row>
								<ion-col
									size-xs="10"
									size-sm="11"
									size-md="11"
									size-lg="11"
									size-xl="11"
								>
									<div class="answer-label-question">{{item.question}}</div>
								</ion-col>
								<ion-col
									size-xs="2"
									size-sm="1"
									size-md="1"
									size-lg="1"
									size-xl="1"
								>
									<div
										v-show="item.can_edit !== 0 || item.type==='branch'"
										class="answer-button-edit ion-activatable ripple-parent ion-text-center"
									>
										<ion-icon
											v-if="areGroupAnswers===false"
											:icon="item.type==='branch' ? eye: create"
											@click="editAnswer(item.input_ref, item.input_index)"
										></ion-icon>

										<ion-ripple-effect
											class="answer-label-button-ripple"
											type="unbounded"
										></ion-ripple-effect>
									</div>
								</ion-col>
							</ion-row>
						</ion-grid>
					</ion-card-title>
				</ion-card-header>

				<ion-card-content
					v-if="item.type==='group'"
					class="answer-card-group"
				>
					<list-item-answer
						:formRef="formRef"
						:entry="entry"
						:errors="errors"
						:item="item"
						:areGroupAnswers="false"
					></list-item-answer>
				</ion-card-content>

				<ion-card-content v-else>
					<list-item-answer
						:formRef="formRef"
						:entry="entry"
						:errors="errors"
						:item="item"
						:areGroupAnswers="areGroupAnswers"
					></list-item-answer>
				</ion-card-content>
			</div>

		</ion-card>

		<ion-infinite-scroll
			class="ion-margin-top"
			@ionInfinite="loadItemsChunk($event)"
			threshold="100px"
			:disabled="isInfiniteScrollDisabled"
		>
			<ion-infinite-scroll-content
				loading-spinner="crescent"
				:loading-text="labels.loading"
			>
			</ion-infinite-scroll-content>
		</ion-infinite-scroll>
	</ion-list>
</template>

<script>
import { eye, create } from 'ionicons/icons';
import { reactive, computed, readonly } from '@vue/reactivity';
import { useRouter } from 'vue-router';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { notificationService } from '@/services/notification-service';
import { entryService } from '@/services/entry/entry-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';

export default {
	name: 'ListAnswers',
	props: {
		items: {
			type: Object,
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
		formRef: {
			type: String,
			required: true
		},
		areGroupAnswers: {
			type: Boolean,
			required: true
		},
		areBranchAnswers: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const statusCodes = STRINGS[language].status_codes;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			itemsChunk: []
		});
		const computedScope = {
			//we disable the lazy loading for answers sets less than 25 questions
			//and for group answers
			isInfiniteScrollDisabled: computed(() => {
				const { areGroupAnswers, items } = props;
				return areGroupAnswers || Object.entries(items).length <= PARAMETERS.ANSWERS_PER_PAGE;
			})
		};
		const methods = {
			async editAnswer(inputRef, inputIndex) {
				if (props.areBranchAnswers) {
					methods.editAnswerBranch(inputRef, inputIndex);
					return false;
				}

				console.log('should open EntriesAdd component for editing hierarchy entry');
				// Show loader
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);
				// Set up an existing entry
				entryService.setUpExisting(props.entry).then(function () {
					//go to EntriesAdd page
					rootStore.routeParams = {
						formRef: props.formRef,
						inputRef,
						inputIndex,
						error: props.errors,
						isBranch: false
					};

					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES_ADD
					});
				});
			},
			async editAnswerBranch(inputRef, inputIndex) {
				console.log('should open EntriesAdd component for editing branch entry');
				const { entry, errors } = readonly(props);
				// Show loader
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);

				//init the edit
				await branchEntryService.setUpExisting(entry);
				rootStore.routeParams = {
					formRef: entry.formRef,
					inputRef: inputRef,
					inputIndex: inputIndex,
					error: errors,
					isBranch: true
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				});
			},
			loadItemsChunk(scrollEvent) {
				const pushItems = () => {
					const max = state.itemsChunk.length + PARAMETERS.ANSWERS_PER_PAGE;
					const min = max - PARAMETERS.ANSWERS_PER_PAGE;
					for (let i = min; i < max; i++) {
						//if there is an answer, push it
						if (Object.values(props.items)[i]) {
							//remap items to array
							state.itemsChunk.push(Object.values(props.items)[i]);
						}
					}
				};

				const loadItems = (scrollEvent) => {
					setTimeout(() => {
						pushItems();
						if (scrollEvent) {
							scrollEvent.target.complete();
						}
						// App logic to determine if all data is loaded
						// and disable the infinite scroll
						if (state.itemsChunk.length === Object.entries(props.items).length) {
							if (scrollEvent) {
								scrollEvent.target.disabled = true;
							}
						}
					}, PARAMETERS.DELAY_MEDIUM);
				};
				loadItems(scrollEvent);
			}
		};

		//lazy load the first chunk. GROUP answers are not lazy loaded
		methods.loadItemsChunk();

		return {
			labels,
			statusCodes,
			state,
			...props,
			...methods,
			...computedScope,
			//icons
			eye,
			create
		};
	}
};
</script>

<style lang="scss" scoped>
.question-popover-button {
	position: relative;
}
</style>