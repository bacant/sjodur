import { usePageContext } from "vike-vue/usePageContext";
import { computed } from "vue";

/** The signed-in user (or null). Comes from the server-side session, see server/auth. */
export function useUser() {
  const pageContext = usePageContext();
  const user = computed(() => pageContext.user ?? null);
  const isAuthenticated = computed(() => user.value !== null);
  const hasRole = (role: string) => user.value?.roles.includes(role) ?? false;
  return { user, isAuthenticated, hasRole };
}
