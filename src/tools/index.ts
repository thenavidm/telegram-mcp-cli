/**
 * The one array. The MCP server, the CLI and the channel all read this, so a
 * tool added here is a command and a channel capability in the same commit.
 */

import type { AnyToolSpec, Profile } from "./kit.js";
import { ACCOUNT_TOOLS } from "./account.js";
import { CHAT_TOOLS } from "./chats.js";
import { MESSAGE_TOOLS } from "./messages.js";
import { MEDIA_TOOLS } from "./media.js";

export const ALL_TOOLS = [
  ...ACCOUNT_TOOLS,
  ...CHAT_TOOLS,
  ...MESSAGE_TOOLS,
  ...MEDIA_TOOLS,
] as unknown as AnyToolSpec[];

/**
 * Tools for a profile.
 *
 * Every definition is sent to the model on every turn, so the profile is the
 * lever that decides what this server costs to have installed. `core` is the
 * default because it covers daily use; the long tail belongs in the CLI, where
 * it costs nothing.
 */
export function toolsFor(profile: Profile | "read"): AnyToolSpec[] {
  if (profile === "read") return ALL_TOOLS.filter((t) => t.risk === "read");
  if (profile === "core") return ALL_TOOLS.filter((t) => t.profile === "core");
  return ALL_TOOLS;
}

/** Which profile the environment asks for. */
export function activeProfile(): Profile | "read" {
  const raw = (process.env.TELEGRAM_TOOLS ?? "core").toLowerCase();
  if (raw === "full") return "full";
  if (raw === "read") return "read";
  return "core";
}
