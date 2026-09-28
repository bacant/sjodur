<!-- Global layout: header with brand, page content, footer. https://vike.dev/Layout -->
<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-line">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <a href="/" class="no-underline hover:no-underline" :aria-label="t('app.name')">
          <BrandLogo class="h-9" />
        </a>
        <div class="flex items-center gap-4">
          <span class="rounded-full bg-ice px-3 py-1 text-xs font-semibold uppercase tracking-wider text-glacier-deep">
            {{ t("app.status") }}
          </span>
          <LocaleSwitch />
        </div>
      </div>
    </header>

    <main id="page-content" class="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <slot />
    </main>

    <footer class="border-t border-line">
      <div class="mx-auto max-w-6xl px-6 py-6 text-sm text-muted">{{ t("app.footer") }}</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import BrandLogo from "../components/BrandLogo.vue";
import LocaleSwitch from "../components/LocaleSwitch.vue";

const { t } = useI18n();
</script>
