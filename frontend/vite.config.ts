import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vike(), tailwindcss(), vue()],
  // vue-i18n reads these compile-time flags; they must exist in the client and the server bundle.
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
    __INTLIFY_DROP_MESSAGE_COMPILER__: false,
  },
  ssr: {
    // Bundle vue-i18n into the server build so the flags above apply there too.
    noExternal: ["vue-i18n", /^@intlify\//],
  },
});
