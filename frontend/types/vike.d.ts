import type { SessionUser } from "../server/auth/session";

declare global {
  namespace Vike {
    interface PageContext {
      /** Signed-in user, set by server/auth (null when anonymous). Passed to the client, see pages/+config.ts. */
      user: SessionUser | null;
    }
  }
}

export {};
