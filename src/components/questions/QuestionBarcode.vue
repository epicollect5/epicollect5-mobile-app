<template>
  <ion-card
    class="question-card"
    :class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
  >
    <ion-card-header class="question-label">
      <ion-card-title>
        {{ state.question }}
      </ion-card-title>
      <ion-card-subtitle
        v-if="hasPattern"
        class="question-properties ion-text-right ion-padding"
      >
        {{ labels.pattern }}:
        <span> &nbsp;{{ state.pattern }} </span>
      </ion-card-subtitle>
    </ion-card-header>
    <ion-card-content
      class="ion-text-center"
      :class="{ 'ion-margin': isGroupInput }"
    >
      <div
        class="question-required"
        v-if="state.required"
      >
        {{ labels.required }}
      </div>
      <div
        class="question-error"
        v-if="hasError"
      >
        {{ errorMessage }}
      </div>
      <ion-grid
        v-if="!isPWA"
        class="ion-no-padding"
      >
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
            <ion-button
              class="question-action-button ion-text-nowrap"
              color="secondary"
              expand="block"
              @click="scan()"
            >
              <ion-icon
                slot="start"
                :icon="scanSharp"
              ></ion-icon>
              {{ labels.scan }}
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
      <ion-grid
        class="ion-no-padding"
        :class="{ 'pwa-margin-fix': isPWA }"
      >
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
            <div class="ion-margin-top">
              <input
                type="text"
                class="question-input"
                :class="{ 'has-error': hasError }"
                :value="state.answer.answer"
                @input="onInputValueChange($event)"
              />
              <div
                class="question-error"
                v-if="hasError"
              >
                {{ errorMessage }}
              </div>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-card-content>
  </ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { scanSharp } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
  props: {
    inputRef: {
      type: String,
      required: true
    },
    type: {
      required: true
    },
    isGroupInput: {
      type: Boolean
    }
  },
  emits: ['question-mounted'],
  setup(props, context) {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const questionType = props.type.toUpperCase();
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
      fileSource: '',
      isScanningBarcode: false
    });

    //set up question
    questionCommonService.setUpInputParams(
      state,
      props.inputRef,
      entriesAddState
    );

    onMounted(async () => {
      console.log('Component Question is mounted, type ->', questionType);
      //emit event to entriesAddState
      context.emit('question-mounted');
    });

    const computedScope = {
      hasPattern: computed(() => {
        return state.pattern !== '' && state.pattern !== null;
      }),
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
      isPWA: computed(() => {
        return rootStore.isPWA;
      })
    };

    const methods = {
      onInputValueChange(event) {
        const value = event.target.value;
        state.answer.answer = utilsService.getSanitisedAnswer(value);
      },

      async scan() {
        //show spinner and hide it immediately
        await notificationService.showProgressDialog(
          STRINGS[language].labels.preparing_scanner,
          STRINGS[language].labels.wait
        );

        notificationService.hideProgressDialog();

        //foreground service helps the app to not be killed
        await notificationService.startForegroundService();

        //request camera permission
        if (rootStore.device.platform === PARAMETERS.ANDROID) {
          cordova.plugins.diagnostic.requestRuntimePermission(
            function (status) {
              if (
                cordova.plugins.diagnostic.permissionStatus.GRANTED === status
              ) {
                console.log('Permission granted');

                utilsService.triggerBarcode().then(
                  function (result) {
                    notificationService.stopForegroundService();
                    //do not override value if the scan action is cancelled by the user
                    if (!result.cancelled) {
                      state.answer.answer = utilsService.getSanitisedAnswer(
                        result.text
                      );
                    }
                  },
                  function (error) {
                    notificationService.stopForegroundService();
                    if (error !== null) {
                      notificationService.showAlert(
                        labels.failed_because + error
                      );
                    }
                  }
                );
              } else {
                //warn user the permission is required
                notificationService.showAlert(labels.missing_permission);
                notificationService.stopForegroundService();
              }
            },
            function (error) {
              notificationService.stopForegroundService();
              notificationService.showAlert(error);
            },
            cordova.plugins.diagnostic.permission.CAMERA
          );
        } else {
          //ios
          cordova.plugins.diagnostic.isCameraAuthorized(
            function (response) {
              if (response) {
                utilsService.triggerBarcode().then(
                  function (result) {
                    //do not override value if the scan action is cancelled by the user
                    if (!result.cancelled) {
                      state.answer.answer = utilsService.getSanitisedAnswer(
                        result.text
                      );
                    }
                  },
                  function (error) {
                    notificationService.showAlert(
                      labels.failed_because + error
                    );
                  }
                );
              } else {
                //request permission
                cordova.plugins.diagnostic.requestCameraAuthorization(
                  function (permission) {
                    console.log(permission);
                    //on iOS permission is true or false only
                    if (permission) {
                      //scan
                      utilsService.triggerBarcode().then(
                        function (result) {
                          //do not override value if the scan action is cancelled by the user
                          if (!result.cancelled) {
                            state.answer.answer =
                              utilsService.getSanitisedAnswer(result.text);
                          }
                        },
                        function (error) {
                          notificationService.showAlert(
                            labels.failed_because + error
                          );
                        }
                      );
                    } else {
                      notificationService.showAlert(labels.missing_permission);
                    }
                  },
                  function () {
                    notificationService.showAlert(labels.missing_permission);
                  }
                );
              }
            },
            function (error) {
              console.error(error);
              notificationService.showAlert(error);
            }
          );
        }
      }
    };

    return {
      labels,
      state,
      ...computedScope,

      ...methods,
      ...props,
      //icons
      scanSharp
    };
  }
};
</script>

<style
  lang="scss"
  scoped
></style>
