import { randomBytes } from "node:crypto";
import type { AuthConfig } from "./config";

/** What the frontend is allowed to know about the signed-in person. Never contains tokens. */
export interface SessionUser {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
}

/** Server-side session. The browser only holds the opaque `id` in a cookie. */
export interface Session {
  id: string;
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Access token expiry as epoch milliseconds. */
  expiresAt: number;
  createdAt: number;
}

export interface SessionStore {
  get(id: string): Promise<Session | null>;
  /** Stores or replaces a session; it expires after ttlSeconds. */
  set(session: Session, ttlSeconds: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** Keeps sessions in process memory. Fine for development and single-instance setups; gone on restart. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { session: Session; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(id: string): Promise<Session | null> {
    const entry = this.sessions.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.sessions.delete(id);
      return null;
    }
    return entry.session;
  }

  async set(session: Session, ttlSeconds: number): Promise<void> {
    this.sessions.set(session.id, { session, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  get size(): number {
    return this.sessions.size;
  }
}

/** Sessions in Redis – shared between instances, survive restarts, can be revoked centrally. */
export class RedisSessionStore implements SessionStore {
  private constructor(
    private readonly redis: {
      get(k: string): Promise<string | null>;
      set(k: string, v: string, mode: "EX", ttl: number): Promise<unknown>;
      del(k: string): Promise<unknown>;
    },
  ) {}

  static async connect(url: string): Promise<RedisSessionStore> {
    const { default: Redis } = await import("ioredis");
    return new RedisSessionStore(new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 }));
  }

  private key(id: string): string {
    return `sjodur:session:${id}`;
  }

  async get(id: string): Promise<Session | null> {
    const raw = await this.redis.get(this.key(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async set(session: Session, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(session.id), JSON.stringify(session), "EX", ttlSeconds);
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.key(id));
  }
}

export async function createSessionStore(config: AuthConfig): Promise<SessionStore> {
  if (config.redisUrl) {
    return RedisSessionStore.connect(config.redisUrl);
  }
  return new MemorySessionStore();
}
