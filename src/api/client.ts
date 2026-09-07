/**
 * A thin wrapper over GramJS.
 *
 * Two jobs: connect lazily, so `--help` and `doctor` never open a socket, and
 * funnel every call through `run` so MTProto's error strings become the one
 * error type both surfaces know how to print.
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import type { Config } from "../config.js";
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
   * log level goes to none before connecting for that reason, not for tidiness.
   */
  async connect(): Promise<TelegramClient> {
    if (this.client) return this.client;

    const client = new TelegramClient(
      new StringSession(this.config.session),
      this.config.apiId,
      this.config.apiHash,
      {
        connectionRetries: 3,
        timeout: this.config.timeout,
        useWSS: false,
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
