/**
 * The one list. The MCP server and the CLI both read it, so a tool added here
 * is a command in the same commit.
 *
 * Each module is a toolset, and the daily tools are also in `core`, which is
 * what the server shows by default: every definition a client loads costs
 * tokens on each message, so the long tail stays off until it is asked for,
 * with TELEGRAM_TOOLS=full as in 0.4, or TELEGRAM_TOOLSETS by module.
 */

import { ACCOUNT_TOOLS } from "./account.js";
import { CHAT_TOOLS } from "./chats.js";
import { CONTACT_TOOLS } from "./contacts.js";
import { ENGAGE_TOOLS } from "./engage.js";
import { FOLDER_TOOLS } from "./folders.js";
import { GROUP_TOOLS } from "./groups.js";
import { slipwayTool, type AnyToolSpec } from "./kit.js";
import { MEDIA_TOOLS } from "./media.js";
import { MESSAGE_TOOLS } from "./messages.js";
import { ORGANIZE_TOOLS } from "./organize.js";
import { PROFILE_TOOLS } from "./profile.js";
import { STICKER_TOOLS } from "./stickers.js";
import { TOPIC_TOOLS } from "./topics.js";

const MODULES: Array<[toolset: string, tools: readonly unknown[]]> = [
  ["account", ACCOUNT_TOOLS],
  ["chats", CHAT_TOOLS],
  ["messages", MESSAGE_TOOLS],
  ["media", MEDIA_TOOLS],
  ["contacts", CONTACT_TOOLS],
  ["groups", GROUP_TOOLS],
  ["engage", ENGAGE_TOOLS],
  ["organize", ORGANIZE_TOOLS],
  ["profile", PROFILE_TOOLS],
  ["topics", TOPIC_TOOLS],
  ["stickers", STICKER_TOOLS],
  ["folders", FOLDER_TOOLS],
];

/** Every spec, in 0.4's order. */
export const ALL_TOOLS = MODULES.flatMap(([, tools]) => tools) as AnyToolSpec[];

/** The same tools as Slipway serves them, each in its module's toolset. */
export const TOOLS = MODULES.flatMap(([toolset, tools]) => (tools as AnyToolSpec[]).map((spec) => slipwayTool(spec, toolset)));

/** The toolsets, with what each holds, for help and agent-context. */
export const TOOLSETS: Record<string, string> = {
  core: "The 13 daily tools: who you are, chats, history, search, send, edit, delete, read, forward and files",
  account: "Who you are signed in as, and resolving a username or id",
  chats: "Listing chats and reading one",
  messages: "History, search, send, edit, delete, mark read and forward",
  media: "Downloading media and sending files",
  contacts: "Contacts, search, blocking and user lookups",
  groups: "Creating, joining, leaving and running groups and channels",
  engage: "Pins, reactions, polls, scheduled messages and message links",
  organize: "Archive, mute, clear history, common chats, the public directory, folders and drafts",
  profile: "Your profile, photos, privacy and voice notes",
  topics: "Forum topics and bot buttons",
  stickers: "Sticker sets, GIFs, albums, contacts and voice transcription",
  folders: "Chat folders, contact import and export, and privacy",
};
