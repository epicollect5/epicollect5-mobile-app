<template>
  <span></span>
</template>

<script>
import {onMounted, computed} from 'vue';
import {toastController} from '@ionic/vue';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {answerErrorReportingConsent} from '@/use/entry/error-reporting-consent';

//the consent toast (PWA): static, no auto-dismiss, no swipe — only yes|no
//hide it; the stored answer then gates reporting from the next boot on
//and immediately after the answer (see error-reporting-consent.js)
//
//If VITE_ROLLBAR_CONSENT_PWA is not set or empty, the toast is never shown.
//If set to 1, the toast is shown based on showErrorReportingConsentPWA.
export default {
  name: 'RollbarConsent',
  setup() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    const consentFlagEnabled = computed(() => {
        return PARAMETERS.ROLLBAR_CONSENT_PWA === '1';
    });

    onMounted(async () => {
      //Skip if consent flag is not enabled
      if (!consentFlagEnabled.value || !rootStore.showErrorReportingConsentPWA) {
        return;
      }
      const toast = await toastController.create({
        message: labels.help_us_improve + '. ' + labels.collect_errors + '?',
        position: 'bottom',
        swipeGesture: false,
        //md styles non-cancel buttons with the primary color, unreadable on
        //the toast background: keep both buttons white like the cancel one
        cssClass: 'rollbar-consent-toast',
        buttons: [
          {
            text: labels.error_reporting_consent_no,
            role: 'cancel',
            handler: () => {
              answerErrorReportingConsent(false);
            }
          },
          {
            text: labels.error_reporting_consent_yes,
            role: 'confirm',
            handler: () => {
              answerErrorReportingConsent(true);
            }
          }
        ]
      });
      await toast.present();
    });

    return {};
  }
};
</script>
