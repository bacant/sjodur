<template>
  <div role="group" :aria-label="t('locale.label')" class="flex gap-1">
    <button
      v-for="option in supportedLocales"
      :key="option"
      type="button"
      class="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors"
      :class="option === locale ? 'bg-navy text-ivory dark:bg-ivory dark:text-navy' : 'text-muted hover:text-ink'"
      :aria-pressed="option === locale"
      @click="setLocale(option)"
    >
      {{ option }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { supportedLocales, type Locale } from "../lib/i18n";
import { useSettingsStore } from "../stores/settings";

const { t, locale } = useI18n();
const settings = useSettingsStore();

function setLocale(next: Locale) {
  settings.setLocale(next);
  locale.value = next;
  document.documentElement.lang = next;
}
</script>
