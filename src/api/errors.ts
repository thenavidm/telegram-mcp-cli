/**
 * One error type, so both surfaces report failures the same way.
 *
 * MTProto returns errors as strings like FLOOD_WAIT_42 or CHAT_ADMIN_REQUIRED.
 * Those are precise but unreadable, so each known one is translated into a
 * sentence that says what to do next.
 */

export type ErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "FORBIDDEN"
  | "REFUSED"
  | "API";

const EXIT: Record<ErrorCode, number> = {
  NOT_CONFIGURED: 10,
  AUTH: 4,
  NOT_FOUND: 3,
  RATE_LIMIT: 7,
  FORBIDDEN: 5,
  REFUSED: 2,
  API: 5,
};

export class TelegramError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number;
  /** Seconds to wait, when Telegram told us. */
  readonly retryAfter?: number;
  readonly hint?: string;

  constructor(code: ErrorCode, message: string, opts: { retryAfter?: number; hint?: string } = {}) {
    super(message);
    this.name = "TelegramError";
    this.code = code;
    this.exitCode = EXIT[code];
    this.retryAfter = opts.retryAfter;
    this.hint = opts.hint;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {}),
      ...(this.hint ? { hint: this.hint } : {}),
    };
  }
}

/**
 * Turn whatever GramJS threw into a TelegramError.
 *
 * FLOOD_WAIT is the one that matters most in practice: Telegram rate limits
 * aggressively on a new session, and the wait is in the error string. Pulling
 * the number out means a caller can actually wait rather than retry blindly.
 */
export function translate(error: unknown): TelegramError {
  if (error instanceof TelegramError) return error;

  const message = (error as Error)?.message ?? String(error);

  const flood = message.match(/FLOOD_WAIT_(\d+)/);
  if (flood) {
    const seconds = Number(flood[1]);
    return new TelegramError("RATE_LIMIT", `Telegram rate limited this account. Wait ${seconds}s.`, {
      retryAfter: seconds,
      hint: "Flood waits are per method and get longer if you keep calling. Wait it out.",
    });
  }

  if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|SESSION_EXPIRED|USER_DEACTIVATED/.test(message)) {
    return new TelegramError("AUTH", "The session is no longer valid.", {
      hint: "Run: telegram-cli login",
    });
  }

  if (/PHONE_CODE_INVALID|PHONE_CODE_EXPIRED|PASSWORD_HASH_INVALID/.test(message)) {
    return new TelegramError("AUTH", message, { hint: "Start the login again." });
  }

  if (/USERNAME_NOT_OCCUPIED|PEER_ID_INVALID|CHAT_ID_INVALID|USER_ID_INVALID/.test(message)) {
    return new TelegramError("NOT_FOUND", "No chat or user matches that identifier.", {
      hint: "Use list_chats or resolve to get a valid id first.",
    });
  }

  if (/CHAT_WRITE_FORBIDDEN|CHAT_ADMIN_REQUIRED|USER_BANNED_IN_CHANNEL|CHAT_RESTRICTED/.test(message)) {
    return new TelegramError("FORBIDDEN", "This account is not allowed to do that in that chat.");
  }

  if (/MESSAGE_ID_INVALID|MESSAGE_DELETE_FORBIDDEN/.test(message)) {
    return new TelegramError("NOT_FOUND", "That message does not exist or cannot be changed.");
  }

  return new TelegramError("API", message);
}

/**
 * A write the guard refused. Local, so it never carries an MTProto code.
 *
 * Separate from the API errors because nothing reached Telegram: the caller
 * needs to know the action did not happen, not that the network failed.
 */
export class WriteBlockedError extends TelegramError {
  constructor(message: string) {
    super("REFUSED", message);
  }
}
