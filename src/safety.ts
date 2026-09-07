/**
 * Decides whether a write is allowed to reach Telegram.
 *
 * The obvious options are both bad. Shipping send and delete unguarded means one
 * mis-parsed instruction messages a real person as you. Removing them and
 * calling that safety just moves the work back to the human.
 *
 * The hazards here are specific. `send` posts as you, to someone else, and
 * Telegram has no unsend beyond a delete they may already have seen. `delete`
 * with revoke removes messages for everyone in the chat and has no undo. Both
 * are one plausible mis-parse away from a model asked to "tidy up my chats".
 * Neither is dangerous when a human meant it.
 *
 * So: everything works, and irreversible operations need an explicit
 * `confirm: true` the model has to set deliberately after reading the tool
 * description. A careless call trips over it; an intentional one clears it in a
 * single retry.
 *
 * TELEGRAM_READ_ONLY=1 turns off every write, for anyone pointing an untrusted
 * agent at their account.
 */

import { appendFileSync } from "node:fs";
import type { Config } from "./config.js";
import { WriteBlockedError } from "./api/errors.js";

/** How risky an operation is, which drives both guarding and MCP annotations. */
export type Risk =
  /** Reads only, changes nothing. */
  | "read"
  /** Creates or updates something reversible. */
  | "write"
  /** Irreversible, or visible to other people the moment it runs. */
  | "destructive";

/** Which surface a guard is protecting, so refusals name the right syntax. */
export type Surface = "mcp" | "cli";

export class WriteGuard {
  private readonly config: Config;
  private readonly surface: Surface;

  constructor(config: Config, surface: Surface = "mcp") {
    this.config = config;
    this.surface = surface;
  }

  /** `--confirm` in a terminal, `confirm: true` in a tool call. */
  private get confirmFlag(): string {
    return this.surface === "cli" ? "--confirm" : "confirm: true";
  }

  get readOnly(): boolean {
    return this.config.readOnly;
  }

  check(tool: string, risk: Risk, confirm: boolean | undefined, summary: string): void {
    if (risk === "read") return;

    if (this.config.readOnly) {
      this.audit(tool, summary, "blocked: read-only");
      throw new WriteBlockedError(
        `${tool} is a write and this server is running with TELEGRAM_READ_ONLY=1. Unset it to allow writes.`,
      );
    }

    if (risk === "destructive") {
      if (!this.config.allowDestructive) {
        this.audit(tool, summary, "blocked: destructive disabled");
        throw new WriteBlockedError(
          `${tool} is irreversible and TELEGRAM_ALLOW_DESTRUCTIVE is off on this server.`,
        );
      }
      if (confirm !== true) {
        this.audit(tool, summary, "blocked: unconfirmed");
        throw new WriteBlockedError(
          `${tool} is irreversible: ${summary}. Nothing has been changed. Re-run with ${this.confirmFlag} if that is what you want.`,
        );
      }
    }

    this.audit(tool, summary, "allowed");
  }

  /** Append-only record of every write that was attempted, allowed or not. */
  private audit(tool: string, summary: string, outcome: string): void {
    if (!this.config.auditPath) return;
    const line = JSON.stringify({ at: new Date().toISOString(), tool, summary, outcome });
    try {
      appendFileSync(this.config.auditPath, `${line}\n`, { mode: 0o600 });
    } catch {
      // An unwritable audit log must never break a tool call.
    }
  }
}

/**
 * MCP tool annotations for a risk level.
 *
 * Set explicitly on every tool, because MCP defaults `destructiveHint` and
 * `openWorldHint` to true when omitted. A read tool left unannotated shows up
 * in a client as destructive, which trains people to ignore the warnings that
 * matter.
 */
export function annotationsFor(risk: Risk): {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
} {
  return {
    readOnlyHint: risk === "read",
    destructiveHint: risk === "destructive",
    // A read is repeatable, and so is a reversible write like marking a chat
    // read twice. Sending again is a second message, so that one is not.
    idempotentHint: risk !== "destructive",
    // Always true: every call here leaves the machine, including the reads.
    openWorldHint: true,
  };
}
