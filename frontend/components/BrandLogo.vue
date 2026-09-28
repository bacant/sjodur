<!-- Horizontal lockup, switches to the inverse version in dark mode. Assets live in public/brand/. -->
<template>
  <picture class="block">
    <source srcset="/brand/sjodur-lockup-horizontal-invers.svg" media="(prefers-color-scheme: dark)" />
    <img src="/brand/sjodur-lockup-horizontal.svg" alt="Sjodur" class="h-full w-auto" :height="height" />
  </picture>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ height?: number }>(), { height: 36 });
</script>
