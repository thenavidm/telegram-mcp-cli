/**
 * Credentials and settings, read from the environment.
 *
 * Telegram needs three things: an api_id and api_hash that identify the
 * application, and a session string that identifies you. The first two come
 * from my.telegram.org and are not secret in any meaningful way. The session
 * string is, because it is full access to the account and does not expire.
 */

export type Config = {
  apiId: number;
  apiHash: string;
  session: string;
  /** Refuse every write, whatever a tool asks for. */
  readOnly: boolean;
  /** Append every write attempt to this file. */
  auditPath: string | undefined;
  /** Allow irreversible tools at all. Off by default. */
  allowDestructive: boolean;
  /** Seconds before an MTProto call gives up. */
  timeout: number;
};

export class ConfigError extends Error {
  readonly code = "NOT_CONFIGURED";
  readonly exitCode = 10;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read the configuration, or explain exactly what is missing.
 *
 * The message names the variable and where to get its value, because "not
 * configured" on its own sends people to the README when the fix is one export.
 */
export function loadConfig(): Config {
  const apiId = int("TELEGRAM_API_ID", 0);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  const session = process.env.TELEGRAM_SESSION ?? "";

  const missing: string[] = [];
  if (!apiId) missing.push("TELEGRAM_API_ID");
  if (!apiHash) missing.push("TELEGRAM_API_HASH");
  if (!session) missing.push("TELEGRAM_SESSION");

  if (missing.length) {
    throw new ConfigError(
      `Missing ${missing.join(", ")}.\n\n` +
        "TELEGRAM_API_ID and TELEGRAM_API_HASH come from https://my.telegram.org\n" +
        "  → API development tools → create an application.\n" +
        "TELEGRAM_SESSION comes from running: telegram-cli login\n",
    );
  }

  return {
    apiId,
    apiHash,
    session,
    readOnly: process.env.TELEGRAM_READ_ONLY === "1",
    auditPath: process.env.TELEGRAM_AUDIT_LOG || undefined,
    allowDestructive: process.env.TELEGRAM_ALLOW_DESTRUCTIVE === "1",
    timeout: int("TELEGRAM_TIMEOUT", 30),
  };
}

/** Config for `login`, which runs before a session exists. */
export function loadAppConfig(): { apiId: number; apiHash: string } {
  const apiId = int("TELEGRAM_API_ID", 0);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  if (!apiId || !apiHash) {
    throw new ConfigError(
      "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH.\n\n" +
        "Get both from https://my.telegram.org → API development tools.\n",
    );
  }
  return { apiId, apiHash };
}
