import { defineStore } from "pinia";
import { ref } from "vue";
import { defaultLocale, type Locale } from "../lib/i18n";

/** User settings that live for the session. Persisting them is a later step (see vike-vue-pinia docs). */
export const useSettingsStore = defineStore("settings", () => {
  const locale = ref<Locale>(defaultLocale);

  function setLocale(next: Locale) {
    locale.value = next;
  }

  return { locale, setLocale };
});
