<template>
  <section class="max-w-3xl">
    <p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{{ t("dashboard.kicker") }}</p>
    <h1 class="mt-3">{{ t("dashboard.greeting", { name: user?.name }) }}</h1>
    <p class="mt-4 text-muted">{{ t("dashboard.lead") }}</p>
  </section>

  <section class="mt-10 rounded-card border border-line bg-surface p-6">
    <h2 class="text-lg">{{ t("dashboard.session") }}</h2>
    <dl class="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="text-muted">{{ t("dashboard.email") }}</dt>
      <dd>{{ user?.email ?? "–" }}</dd>
      <dt class="text-muted">{{ t("dashboard.roles") }}</dt>
      <dd>{{ user?.roles.join(", ") || "–" }}</dd>
      <dt class="text-muted">{{ t("dashboard.api") }}</dt>
      <dd>{{ apiStatus }}</dd>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApi } from "../../lib/api";
import { useUser } from "../../lib/user";

const { t } = useI18n();
const { user } = useUser();
const { apiFetch } = useApi();
const apiStatus = ref("…");

// Proves the whole chain: browser → Hono proxy (adds the Bearer token) → Spring resource server.
onMounted(async () => {
  try {
    const response = await apiFetch("/api/me");
    apiStatus.value = response.ok
      ? `${t("dashboard.apiOk")} (${(await response.json()).sub})`
      : `HTTP ${response.status}`;
  } catch {
    apiStatus.value = t("dashboard.apiUnreachable");
  }
});
</script>
