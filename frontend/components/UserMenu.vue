<!--
  Login/logout in the header. rel="external" makes Vike do a full page load: /auth/* are
  server routes, not pages. Logout is a POST form carrying the CSRF token, so a link from
  another site cannot log the user out.
-->
<template>
  <div class="flex items-center gap-3 text-sm">
    <template v-if="user">
      <a href="/app" class="font-semibold no-underline hover:underline">{{ user.name }}</a>
      <form method="post" action="/auth/logout">
        <input type="hidden" name="_csrf" :value="csrfToken ?? ''" />
        <button type="submit" class="cursor-pointer text-muted hover:text-ink">{{ t("auth.logout") }}</button>
      </form>
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
import { useApi } from "../lib/api";
import { useUser } from "../lib/user";

const { t } = useI18n();
const { user } = useUser();
const { csrfToken } = useApi();
const pageContext = usePageContext();
const loginHref = computed(() => `/auth/login?returnTo=${encodeURIComponent(pageContext.urlPathname)}`);
</script>
