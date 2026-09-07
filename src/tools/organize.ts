/** Keeping the chat list under control: archive, mute, folders and drafts. */

import { z } from "zod";
import { clamp, confirmArg, defineTool, selectArg } from "./kit.js";
import { chatRow, displayName, page, sanitize, select } from "../format/render.js";

type Any = Record<string, unknown>;

export const archiveChat = defineTool({
  name: "archive",
  title: "Archive or unarchive a chat",
  description:
    "Move a chat into the archive, or back out with `archive: false`. One tool, because it is one call with a folder id.",
  schema: {
    peer: z.string().describe("The chat."),
    archive: z.boolean().optional().describe("True to archive, false to restore. Default true."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, archive }) => `${archive === false ? "unarchive" : "archive"} ${peer}`,
  async handler({ peer, archive }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.folders.EditPeerFolders({
          folderPeers: [
            new ctx.api.api.InputFolderPeer({
              peer: entity as never,
              folderId: archive === false ? 0 : 1,
            }),
          ] as never,
        }),
      );
      return { archived: archive !== false };
    });
  },
});

export const muteChat = defineTool({
  name: "mute",
  title: "Mute or unmute a chat",
  description:
    "Silence notifications for a chat, or restore them with `mute: false`. `until` mutes temporarily.",
  schema: {
    peer: z.string().describe("The chat."),
    mute: z.boolean().optional().describe("True to mute, false to unmute. Default true."),
    until: z
      .number()
      .optional()
      .describe("Unix timestamp to mute until. Omit for indefinitely."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, mute }) => `${mute === false ? "unmute" : "mute"} ${peer}`,
  async handler({ peer, mute, until }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const off = mute !== false;
      await client.invoke(
        new ctx.api.api.account.UpdateNotifySettings({
          peer: new ctx.api.api.InputNotifyPeer({ peer: entity as never }) as never,
          settings: new ctx.api.api.InputPeerNotifySettings({
            muteUntil: off ? (until ?? 2147483647) : 0,
          }),
        }),
      );
      return { muted: off };
    });
  },
});

export const deleteHistory = defineTool({
  name: "delete_history",
  title: "Delete a chat's history",
  description:
    "Wipe the message history of a chat. With `revoke` it deletes for everyone, not only your copy. There is no undo.",
  schema: {
    peer: z.string().describe("The chat."),
    revoke: z.boolean().optional().describe("Delete for everyone too. Default false."),
    ...confirmArg,
  },
  risk: "destructive",
  profile: "full",
  summary: ({ peer, revoke }) =>
    `delete history of ${peer}${revoke ? " for everyone" : ""}`,
  async handler({ peer, revoke }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.DeleteHistory({
          peer: entity as never,
          maxId: 0,
          revoke: revoke === true,
        }),
      );
      return { deleted: true, revoked: revoke === true };
    });
  },
});

export const commonChats = defineTool({
  name: "common_chats",
  title: "Chats you share with someone",
  description: "Groups and channels you and another user are both in.",
  schema: {
    peer: z.string().describe("The other person."),
    limit: z.number().optional().describe("How many. Default 20, max 100."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, limit }, ctx) {
    const take = clamp(limit, 20, 100);
    const entity = await ctx.api.entity(peer);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetCommonChats({
          userId: entity as never,
          maxId: 0 as never,
          limit: take,
        }),
      )) as unknown as { chats?: Any[] };
      return (res.chats ?? []).map((c) => ({
        id: String((c.id as { value?: unknown })?.value ?? c.id ?? ""),
        name: displayName(c),
      }));
    });
    return page(rows);
  },
});

export const searchPublic = defineTool({
  name: "search_public",
  title: "Search public chats",
  description:
    "Search Telegram's public directory for groups, channels and users you are not already in.",
  schema: {
    query: z.string().describe("What to search for."),
    limit: z.number().optional().describe("How many. Default 20, max 50."),
    ...selectArg,
  },
  risk: "read",
  profile: "full",
  async handler({ query, limit, fields }, ctx) {
    const take = clamp(limit, 20, 50);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.contacts.Search({ q: query, limit: take }),
      )) as unknown as { chats?: Any[]; users?: Any[] };
      return [...(res.chats ?? []), ...(res.users ?? [])].map((e) => ({
        id: String((e.id as { value?: unknown })?.value ?? e.id ?? ""),
        name: displayName(e),
        username: e.username ? `@${String(e.username)}` : undefined,
        kind: e.className === "User" ? "user" : e.broadcast ? "channel" : "group",
      }));
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const listFolders = defineTool({
  name: "list_folders",
  title: "List chat folders",
  description: "Your chat folders, with the chats pinned into each.",
  schema: {},
  risk: "read",
  profile: "full",
  async handler(_args, ctx) {
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetDialogFilters(),
      )) as unknown as { filters?: Any[] } | Any[];
      const filters = Array.isArray(res) ? res : (res.filters ?? []);
      return filters
        .filter((f) => f.className !== "DialogFilterDefault")
        .map((f) => ({
          id: Number(f.id ?? 0),
          title: sanitize(String((f.title as Any)?.text ?? f.title ?? "")),
          included: ((f.includePeers as Any[]) ?? []).length,
          pinned: ((f.pinnedPeers as Any[]) ?? []).length,
        }));
    });
    return page(rows);
  },
});

export const listDrafts = defineTool({
  name: "list_drafts",
  title: "List unsent drafts",
  description: "Messages you started typing and never sent, across every chat.",
  schema: { ...selectArg },
  risk: "read",
  profile: "full",
  async handler({ fields }, ctx) {
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetAllDrafts(),
      )) as unknown as { updates?: Any[] };
      return (res.updates ?? [])
        .filter((u) => u.className === "UpdateDraftMessage")
        .map((u) => ({
          peer: String((u.peer as Any)?.userId ?? (u.peer as Any)?.channelId ?? (u.peer as Any)?.chatId ?? ""),
          text: sanitize(String((u.draft as Any)?.message ?? "")),
        }))
        .filter((d) => d.text);
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const saveDraft = defineTool({
  name: "save_draft",
  title: "Save or clear a draft",
  description:
    "Write a draft into a chat without sending it. An empty string clears the draft, which is why there is no separate clear tool.",
  schema: {
    peer: z.string().describe("The chat."),
    text: z.string().describe("Draft body. Empty string clears it."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, text }) => (text ? `draft in ${peer}` : `clear draft in ${peer}`),
  async handler({ peer, text }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.SaveDraft({ peer: entity as never, message: text }),
      );
      return { saved: Boolean(text), cleared: !text };
    });
  },
});

export const ORGANIZE_TOOLS = [
  archiveChat,
  muteChat,
  deleteHistory,
  commonChats,
  searchPublic,
  listFolders,
  listDrafts,
  saveDraft,
];
