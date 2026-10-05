/**
 * Credentials and settings, read from the environment.
 *
 * Telegram needs three things: an api_id and api_hash that identify the
 * application, and a session string that identifies you. The first two come
 * from my.telegram.org and are not secret in any meaningful way. The session
 * string is, because it is full access to the account and does not expire.
 */

export type Account = {
  /** The name this account answers to, from the env var suffix. */
  label: string;
  session: string;
};

export type Config = {
  apiId: number;
  apiHash: string;
  session: string;
  /** Every configured account, the first being the default. */
  accounts: Account[];
  /** Seconds before an MTProto call gives up. */
  timeout: number;
  /** The credentials not set yet, which the first call that needs Telegram reports. */
  missing: string[];
};

export class ConfigError extends Error {
  readonly code = "NOT_CONFIGURED";
  readonly exitCode = 10;
}

function int(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read the configuration. Nothing here throws: a server with no credentials
 * still starts and lists its tools, and the first call that needs Telegram
 * says exactly what is missing, through `requireConfig`. Read-only mode, the
 * switch for irreversible tools and the audit log are Slipway's now.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiId = int(env, "TELEGRAM_API_ID", 0);
  const apiHash = env.TELEGRAM_API_HASH ?? "";
  const session = env.TELEGRAM_SESSION ?? "";

  const missing: string[] = [];
  if (!apiId) missing.push("TELEGRAM_API_ID");
  if (!apiHash) missing.push("TELEGRAM_API_HASH");
  if (!session) missing.push("TELEGRAM_SESSION");

  return {
    apiId,
    apiHash,
    session,
    accounts: discoverAccounts(session, env),
    timeout: int(env, "TELEGRAM_TIMEOUT", 30),
    missing,
  };
}

/**
 * The configuration, or exactly what is missing. The message names the
 * variable and where to get its value, because "not configured" on its own
 * sends people to the README when the fix is one export.
 */
export function requireConfig(config: Config): Config {
  if (config.missing.length === 0) return config;
  throw new ConfigError(
    `Missing ${config.missing.join(", ")}. ` +
      "TELEGRAM_API_ID and TELEGRAM_API_HASH come from https://my.telegram.org, API development tools, create an application. " +
      "TELEGRAM_SESSION comes from running: telegram-cli login",
  );
}

/**
 * Find every configured account.
 *
 * TELEGRAM_SESSION is the default. TELEGRAM_SESSION_<LABEL> adds a named one,
 * so a personal and a work account can share one server and be chosen per call
 * rather than per process.
 */
export function discoverAccounts(primary: string, env: NodeJS.ProcessEnv = process.env): Account[] {
  const accounts: Account[] = primary ? [{ label: "default", session: primary }] : [];
  for (const [key, value] of Object.entries(env)) {
    const m = key.match(/^TELEGRAM_SESSION_([A-Z0-9_]+)$/);
    if (!m || !value) continue;
    accounts.push({ label: (m[1] as string).toLowerCase(), session: value });
  }
  return accounts;
}

/** Pick an account by name, loosely matched, defaulting to the first. */
export function selectAccount(config: Config, hint?: string): Account {
  const first = config.accounts[0];
  if (!first) throw new ConfigError("No Telegram account is configured.");
  if (!hint) return first;
  const want = hint.toLowerCase();
  const found =
    config.accounts.find((a) => a.label === want) ??
    config.accounts.find((a) => a.label.startsWith(want));
  if (!found) {
    throw new ConfigError(
      `No account named "${hint}". Configured: ${config.accounts.map((a) => a.label).join(", ")}.`,
    );
  }
  return found;
}

/** Config for `login`, which runs before a session exists. */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): { apiId: number; apiHash: string } {
  const apiId = int(env, "TELEGRAM_API_ID", 0);
  const apiHash = env.TELEGRAM_API_HASH ?? "";
  if (!apiId || !apiHash) {
    throw new ConfigError(
      "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH.\n\n" +
        "Get both from https://my.telegram.org → API development tools.\n",
    );
  }
  return { apiId, apiHash };
}
