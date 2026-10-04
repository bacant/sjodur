<template>
  <section class="max-w-3xl">
    <p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{{ t("home.kicker") }}</p>
    <h1 class="mt-3 text-4xl md:text-5xl">{{ t("home.title") }}</h1>
    <p class="mt-5 text-lg text-muted">{{ t("home.lead") }}</p>
  </section>

  <section class="mt-14 grid gap-6 md:grid-cols-3">
    <article v-for="pillar in pillars" :key="pillar" class="rounded-card border border-line bg-surface p-6 shadow-card">
      <h2 class="text-xl">{{ t(`home.pillars.${pillar}.title`) }}</h2>
      <p class="mt-2 text-muted">{{ t(`home.pillars.${pillar}.text`) }}</p>
    </article>
  </section>

  <section class="mt-14 rounded-card border border-line bg-surface p-6">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{{ t("home.sample.label") }}</p>
    <dl class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="flex items-baseline justify-between rounded-xl bg-ice/60 px-4 py-3 dark:bg-slate">
        <dt class="text-muted">{{ t("home.sample.income") }}</dt>
        <dd class="text-xl"><AmountChip amount="1234.56" /></dd>
      </div>
      <div class="flex items-baseline justify-between rounded-xl bg-amber-tint/60 px-4 py-3 dark:bg-slate">
        <dt class="text-muted">{{ t("home.sample.expense") }}</dt>
        <dd class="text-xl"><AmountChip amount="-87.90" /></dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AmountChip from "../../components/AmountChip.vue";

const { t } = useI18n();
const pillars = ["ledger", "forecast", "invest"] as const;
</script>
