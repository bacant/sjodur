import type { Config } from "vike/types";
import vikeVue from "vike-vue/config";
import vikeVuePinia from "vike-vue-pinia/config";

// Default config, can be overridden per page. https://vike.dev/config
export default {
  title: "Sjodur",
  description: "Budget book, cash-flow forecasting and investment tracking in one app.",
  lang: "de",
  extends: [vikeVue, vikeVuePinia],
} satisfies Config;
