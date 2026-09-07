/** Chats: what conversations exist, and what one of them is. */

import { z } from "zod";
import { clamp, defineTool, selectArg } from "./kit.js";
import { chatRow, displayName, page, peerKind, select } from "../format/render.js";

export const listChats = defineTool({
  name: "list_chats",
  title: "List chats",
  description:
    "Recent conversations, newest first. Returns a compact row per chat: id, name, kind, unread count and a short preview of the last message. Use `fields` to cut it down further.",
  schema: {
    limit: z.number().optional().describe("How many chats. Default 20, max 200."),
    unread_only: z.boolean().optional().describe("Only chats with unread messages."),
    kind: z
      .enum(["user", "group", "channel", "bot"])
      .optional()
      .describe("Only this kind of chat."),
    ...selectArg,
  },
  risk: "read",
  profile: "core",
  async handler({ limit, unread_only, kind, fields }, ctx) {
    const take = clamp(limit, 20, 200);
    const rows = await ctx.api.run(async (client) => {
      // Over-fetch when filtering, or a filter can empty an otherwise full page.
      const dialogs = await client.getDialogs({ limit: kind || unread_only ? take * 3 : take });
      return dialogs
        .map((d) => chatRow(d as unknown as Record<string, unknown>))
        .filter((r) => (unread_only ? (r.unread ?? 0) > 0 : true))
        .filter((r) => (kind ? r.kind === kind : true))
        .slice(0, take);
    });
    return page(select(rows as unknown as Record<string, unknown>[], fields));
  },
});

export const getChat = defineTool({
  name: "get_chat",
  title: "Get one chat",
  description:
    "Details of a single chat: name, kind, username, member count and description where the chat has them.",
  schema: {
    peer: z.string().describe("A @username, numeric id, or 'me'."),
  },
  risk: "read",
  profile: "core",
  async handler({ peer }, ctx) {
    const entity = (await ctx.api.entity(peer)) as unknown as Record<string, unknown>;
    return {
      id: String((entity.id as { value?: unknown })?.value ?? entity.id ?? ""),
      name: displayName(entity),
      kind: peerKind(entity),
      username: entity.username ? `@${String(entity.username)}` : undefined,
      participants: entity.participantsCount ? Number(entity.participantsCount) : undefined,
      verified: entity.verified ? true : undefined,
    };
  },
});

export const CHAT_TOOLS = [listChats, getChat];
