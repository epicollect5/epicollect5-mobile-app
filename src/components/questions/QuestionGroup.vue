<template>
	<div v-if="state.groupHasError">
		<ion-item-divider
			color="danger"
			class="entry-error"
			sticky
		>
			<ion-label class="entry-title-label ion-text-wrap">
				{{ statusCodes['ec5_128']}}
			</ion-label>
		</ion-item-divider>
	</div>
	<ion-card class="question-card animate__animated animate__fadeIn">

		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
		</ion-card-header>
		<ion-card-content class="question-group animate__animated animate__fadeIn">
			<div
				v-for="groupInput in state.groupInputs"
				:key="groupInput.ref"
			>
				<question-text
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='text'"
				></question-text>
				<question-integer
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='integer'"
				></question-integer>
				<question-decimal
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='decimal'"
				></question-decimal>
				<question-location
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='location'"
				></question-location>
				<question-group
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='group'"
				></question-group>
				<question-photo
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='photo'"
				></question-photo>
				<question-phone
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='phone'"
				></question-phone>
				<question-barcode
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='barcode'"
				></question-barcode>
				<question-audio
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='audio'"
				></question-audio>
				<question-video
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='video'"
				></question-video>
				<question-radio
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='radio'"
				></question-radio>
				<question-dropdown
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='dropdown'"
				></question-dropdown>
				<question-checkbox
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='checkbox'"
				></question-checkbox>
				<question-branch
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='branch'"
				></question-branch>
				<question-textarea
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='textarea'"
				></question-textarea>
				<question-readme
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='readme'"
				></question-readme>
				<question-date
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='date'"
				></question-date>
				<question-time
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='time'"
				></question-time>
				<question-search
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='searchsingle'"
				></question-search>
				<question-search
					:isGroupInput="isGroupInput"
					:type="groupInput.type"
					:inputRef="groupInput.ref"
					v-if="groupInput.type==='searchmultiple'"
				></question-search>

			</div>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { reactive, computed } from '@vue/reactivity';
import { inject, provide } from 'vue';
import { projectModel } from '@/models/project-model.js';
import questionAudio from '@/components/questions/QuestionAudio';
import questionBarcode from '@/components/questions/QuestionBarcode';
import questionBranch from '@/components/questions/QuestionBranch';
import questionCheckbox from '@/components/questions/QuestionCheckbox';
import questionDate from '@/components/questions/QuestionDate';
import questionDecimal from '@/components/questions/QuestionDecimal';
import questionDropdown from '@/components/questions/QuestionDropdown';
import questionInteger from '@/components/questions/QuestionInteger';
import questionLocation from '@/components/questions/QuestionLocation';
import questionPhone from '@/components/questions/QuestionPhone';
import questionPhoto from '@/components/questions/QuestionPhoto';
import questionRadio from '@/components/questions/QuestionRadio';
import questionReadme from '@/components/questions/QuestionReadme';
import questionSearch from '@/components/questions/QuestionSearch';
import questionText from '@/components/questions/QuestionText';
import questionTextarea from '@/components/questions/QuestionTextarea';
import questionTime from '@/components/questions/QuestionTime';
import questionVideo from '@/components/questions/QuestionVideo';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		questionAudio,
		questionBarcode,
		questionBranch,
		questionCheckbox,
		questionDate,
		questionDecimal,
		questionDropdown,
		questionInteger,
		questionLocation,
		questionPhone,
		questionPhoto,
		questionRadio,
		questionReadme,
		questionSearch,
		questionText,
		questionTextarea,
		questionTime,
		questionVideo
	},
	props: {
		inputRef: {
			type: String,
			required: true
		},
		type: {
			type: String,
			required: true
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const questionType = props.type.toUpperCase();
		const entriesAddState = inject('entriesAddState');
		const entriesAddScope = rootStore.entriesAddScope;
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const statusCodes = STRINGS[language].status_codes;

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
			groupHasError: false,
			groupInputs: [],
			groupInputDetails: []
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		// We want the whole confirmAnswer object here
		state.confirmAnswer = entriesAddState.confirmAnswer;

		state.groupInputs = projectModel.getGroupInputs(
			entriesAddScope.entryService.form.formRef,
			props.inputRef
		);

		state.groupInputs.forEach((groupInput) => {
			state.groupInputDetails.push(entriesAddState.inputsExtra[groupInput.ref].data);

			//if there is an error on a group question, show banner up top
			if (state.error.errors[groupInput.ref]?.message) {
				state.groupHasError = true;
			}

			// Create this group question 'verify' objects

			state.confirmAnswer[groupInput.ref] = {
				verify: groupInput.verify,
				answer:
					//if confirmAnswer does not exist yet, set it to empty string ''
					entriesAddState.confirmAnswer[groupInput.ref]?.answer || ''
			};
		});

		//console.log(state.groupInputs);

		const computedScope = {
			hasError: computed(() => {
				return utilsService.hasQuestionError(state);
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			}),
			isGroupInput: true
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		const methods = {};

		provide('questionGroupState', state);
		return {
			labels,
			state,
			statusCodes,
			...computedScope,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>