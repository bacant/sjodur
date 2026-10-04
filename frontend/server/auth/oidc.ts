import * as oidc from "openid-client";
import type { AuthConfig } from "./config";
import type { SessionUser } from "./session";

export interface LoginParams {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface CallbackParams {
  codeVerifier: string;
  state: string;
  nonce: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Epoch milliseconds. Falls back to 5 minutes if the provider omits expires_in. */
  expiresAt: number;
  claims?: Record<string, unknown>;
}

/**
 * Thin wrapper around openid-client. Discovery happens lazily on first use, so the
 * frontend starts even while the identity provider is still booting; a failed
 * discovery is retried on the next request.
 */
export class OidcClient {
  private configuration?: Promise<oidc.Configuration>;

  constructor(private readonly config: AuthConfig) {}

  get redirectUri(): string {
    return `${this.config.publicUrl}/auth/callback`;
  }

  get postLogoutRedirectUri(): string {
    return `${this.config.publicUrl}/`;
  }

  private async configuration$(): Promise<oidc.Configuration> {
    if (!this.configuration) {
      const execute = this.config.issuer.startsWith("http://") ? [oidc.allowInsecureRequests] : [];
      this.configuration = oidc
        .discovery(new URL(this.config.issuer), this.config.clientId, this.config.clientSecret, undefined, { execute })
        .catch((error: unknown) => {
          this.configuration = undefined;
          throw error;
        });
    }
    return this.configuration;
  }

  static async pkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const codeVerifier = oidc.randomPKCECodeVerifier();
    return { codeVerifier, codeChallenge: await oidc.calculatePKCECodeChallenge(codeVerifier) };
  }

  static randomState(): string {
    return oidc.randomState();
  }

  static randomNonce(): string {
    return oidc.randomNonce();
  }

  async loginUrl(params: LoginParams): Promise<URL> {
    const configuration = await this.configuration$();
    return oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: this.config.scope,
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
    });
  }

  async exchangeCode(callbackUrl: URL, params: CallbackParams): Promise<TokenSet> {
    const configuration = await this.configuration$();
    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: params.codeVerifier,
      expectedState: params.state,
      expectedNonce: params.nonce,
      idTokenExpected: true,
    });
    return toTokenSet(tokens);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const configuration = await this.configuration$();
    return toTokenSet(await oidc.refreshTokenGrant(configuration, refreshToken));
  }

  async logoutUrl(idToken?: string): Promise<URL> {
    const configuration = await this.configuration$();
    return oidc.buildEndSessionUrl(configuration, {
      post_logout_redirect_uri: this.postLogoutRedirectUri,
      ...(idToken ? { id_token_hint: idToken } : { client_id: this.config.clientId }),
    });
  }
}

function toTokenSet(tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers): TokenSet {
  const expiresIn = tokens.expiresIn() ?? 300;
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + expiresIn * 1000,
    claims: tokens.claims() as Record<string, unknown> | undefined,
  };
}

/** Maps ID-token claims (Keycloak layout) to the user object the frontend may see. */
export function userFromClaims(claims: Record<string, unknown>): SessionUser {
  const sub = String(claims.sub ?? "");
  if (!sub) throw new Error("ID token without sub claim");
  const realmAccess = claims.realm_access as { roles?: unknown } | undefined;
  const roles = Array.isArray(realmAccess?.roles) ? realmAccess.roles.map(String) : [];
  const name =
    (typeof claims.name === "string" && claims.name) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.email === "string" && claims.email) ||
    sub;
  return {
    sub,
    name,
    email: typeof claims.email === "string" ? claims.email : undefined,
    roles,
  };
}
