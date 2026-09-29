<!-- Login/logout in the header. rel="external" makes Vike do a full page load: /auth/* are server routes, not pages. -->
<template>
  <div class="flex items-center gap-3 text-sm">
    <template v-if="user">
      <a href="/app" class="font-semibold no-underline hover:underline">{{ user.name }}</a>
      <a href="/auth/logout" rel="external" class="text-muted no-underline hover:text-ink">{{ t("auth.logout") }}</a>
    </template>
    <a
      v-else
      :href="loginHref"
      rel="external"
      class="rounded-full bg-navy px-4 py-1.5 font-semibold text-ivory no-underline hover:bg-slate hover:no-underline dark:bg-ivory dark:text-navy"
    >
      {{ t("auth.login") }}
    </a>
  </div>
</template>

<script setup lang="ts">
import { usePageContext } from "vike-vue/usePageContext";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useUser } from "../lib/user";

const { t } = useI18n();
const { user } = useUser();
const pageContext = usePageContext();
const loginHref = computed(() => `/auth/login?returnTo=${encodeURIComponent(pageContext.urlPathname)}`);
</script>
