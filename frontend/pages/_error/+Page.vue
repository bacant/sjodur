<template>
  <section class="max-w-xl">
    <p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{{ is404 ? "404" : "500" }}</p>
    <h1 class="mt-3">{{ is404 ? t("error.notFound") : t("error.generic") }}</h1>
    <p v-if="abortReason" class="mt-4 text-muted">{{ abortReason }}</p>
    <p class="mt-8">
      <a href="/">{{ t("error.back") }}</a>
    </p>
  </section>
</template>

<script lang="ts" setup>
import { usePageContext } from "vike-vue/usePageContext";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const pageContext = usePageContext();
const is404 = pageContext.is404;
const abortReason = typeof pageContext.abortReason === "string" ? pageContext.abortReason : undefined;
</script>
