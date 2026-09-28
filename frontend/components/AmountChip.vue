<!-- Shows an amount with the semantic colour for gains (teal) and losses (amber). -->
<template>
  <span class="tabular font-semibold" :class="toneClass[tone]">{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { intlLocale, type Locale } from "../lib/i18n";
import { amountTone, formatMoney, toneClass } from "../lib/money";

const props = withDefaults(defineProps<{ amount: string | number; currency?: string }>(), { currency: "EUR" });

const { locale } = useI18n();
const tone = computed(() => amountTone(props.amount));
const formatted = computed(() =>
  formatMoney(props.amount, props.currency, intlLocale[locale.value as Locale] ?? "de-DE"),
);
</script>
