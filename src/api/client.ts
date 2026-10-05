/**
 * A thin wrapper over GramJS.
 *
 * Two jobs: connect lazily, so `--help` and `doctor` never open a socket, and
 * funnel every call through `run` so MTProto's error strings become the one
 * error type both surfaces know how to print.
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Logger, LogLevel } from "telegram/extensions/Logger.js";
import { ConfigError, requireConfig, type Config } from "../config.js";
import { translate } from "./errors.js";

/** A username, phone, numeric id, or "me". */
export type Peer = string | number;

export class TelegramApi {
  private client: TelegramClient | undefined;

  constructor(private readonly config: Config) {}

  /**
   * Connect on first use.
   *
   * GramJS logs protocol chatter to stdout by default, which corrupts the MCP
   * stdio transport: the client is reading JSON-RPC on that exact stream. The
   * logger is silent from construction, because the constructor itself prints
   * a version banner, and setLogLevel afterwards is too late for that line.
   */
  async connect(): Promise<TelegramClient> {
    if (this.client) return this.client;
    // Missing credentials are reported here, by the first call that needs them, as setup.
    requireConfig(this.config);

    // GramJS throws "Not a valid string" for a session it cannot read, before any
    // connection. That is a setup problem, so it says which variable and what to run.
    let session: StringSession;
    try {
      session = new StringSession(this.config.session);
    } catch {
      throw new ConfigError("TELEGRAM_SESSION is not a session string telegram-cli login printed. Run: telegram-cli login");
    }

    const client = new TelegramClient(
      session,
      this.config.apiId,
      this.config.apiHash,
      {
        connectionRetries: 3,
        timeout: this.config.timeout,
        useWSS: false,
        baseLogger: new Logger(LogLevel.NONE),
      },
    );

    client.setLogLevel("none" as never);

    try {
      await client.connect();
    } catch (error) {
      throw translate(error);
    }

    this.client = client;
    return client;
  }

  /** Run one call, translating whatever MTProto throws. */
  async run<T>(fn: (client: TelegramClient) => Promise<T>): Promise<T> {
    const client = await this.connect();
    try {
      return await fn(client);
    } catch (error) {
      throw translate(error);
    }
  }

  /**
   * Resolve a peer to an entity the API will accept.
   *
   * Callers pass whatever they have: "@navid", "navid", a numeric id, or "me".
   * A leading @ is stripped because getEntity rejects it on some paths and
   * accepts it on others, and that inconsistency should not reach a tool.
   */
  async entity(peer: Peer) {
    return this.run(async (client) => {
      const key = typeof peer === "string" ? peer.replace(/^@/, "") : peer;
      return client.getEntity(key as never);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.disconnect();
    } catch {
      // The process is ending and the socket closes with it either way, so a
      // failure here is noise rather than information.
    }
    this.client = undefined;
  }

  /** The raw schema, for the handful of calls GramJS has no helper for. */
  get api() {
    return Api;
  }
}
