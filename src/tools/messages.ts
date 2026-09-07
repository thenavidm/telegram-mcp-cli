/** Messages: reading history, searching it, and writing into it. */

import { z } from "zod";
import { clamp, confirmArg, defineTool, selectArg } from "./kit.js";
import { messageRow, page, select } from "../format/render.js";

export const history = defineTool({
  name: "history",
  title: "Read chat history",
  description:
    "Messages from one chat, newest first. Bodies are truncated to a preview unless `full` is set, because a long chat returned whole is mostly wasted context.",
  schema: {
    peer: z.string().describe("A @username, numeric id, or 'me'."),
    limit: z.number().optional().describe("How many messages. Default 20, max 100."),
    before_id: z.number().optional().describe("Only messages older than this id. Use next_cursor to page."),
    full: z.boolean().optional().describe("Keep whole message bodies instead of previews."),
    ...selectArg,
  },
  risk: "read",
  profile: "core",
  async handler({ peer, limit, before_id, full, fields }, ctx) {
    const take = clamp(limit, 20, 100);
    const entity = await ctx.api.entity(peer);
    const rows = await ctx.api.run(async (client) => {
      const messages = await client.getMessages(entity as never, {
        limit: take,
        ...(before_id ? { offsetId: before_id } : {}),
      });
      return messages.map((m) => messageRow(m as unknown as Record<string, unknown>, { full }));
    });
    const oldest = rows.length === take ? rows[rows.length - 1]?.id : undefined;
    return page(select(rows as unknown as Record<string, unknown>[], fields), oldest);
  },
});

export const search = defineTool({
  name: "search",
  title: "Search messages",
  description:
    "Search message text, either inside one chat or across the whole account when no peer is given.",
  schema: {
    query: z.string().describe("Text to search for."),
    peer: z.string().optional().describe("Limit to one chat. Omit to search everywhere."),
    limit: z.number().optional().describe("How many results. Default 20, max 100."),
    ...selectArg,
  },
  risk: "read",
  profile: "core",
  async handler({ query, peer, limit, fields }, ctx) {
    const take = clamp(limit, 20, 100);
    const entity = peer ? await ctx.api.entity(peer) : undefined;
    const rows = await ctx.api.run(async (client) => {
      const messages = await client.getMessages((entity ?? undefined) as never, {
        limit: take,
        search: query,
      });
      return messages.map((m) => messageRow(m as unknown as Record<string, unknown>));
    });
    return page(select(rows as unknown as Record<string, unknown>[], fields));
  },
});

export const send = defineTool({
  name: "send",
  title: "Send a message",
  description:
    "Send a message to a chat. This is visible to the recipient immediately and posts as you, so only send what was actually asked for.",
  schema: {
    peer: z.string().describe("A @username, numeric id, or 'me' for Saved Messages."),
    text: z.string().describe("The message body. Markdown is supported."),
    reply_to: z.number().optional().describe("Message id to reply to."),
    silent: z.boolean().optional().describe("Deliver without a notification sound."),
  },
  risk: "write",
  profile: "core",
  summary: ({ peer, text }) => `send to ${peer}: ${text.slice(0, 60)}`,
  async handler({ peer, text, reply_to, silent }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const sent = await client.sendMessage(entity as never, {
        message: text,
        ...(reply_to ? { replyTo: reply_to } : {}),
        ...(silent ? { silent: true } : {}),
      });
      return { sent: true, id: Number((sent as unknown as { id?: unknown }).id ?? 0) };
    });
  },
});

export const edit = defineTool({
  name: "edit",
  title: "Edit a message",
  description: "Change the text of a message you sent. Telegram marks it edited.",
  schema: {
    peer: z.string().describe("The chat the message is in."),
    message_id: z.number().describe("Id of the message to edit."),
    text: z.string().describe("The replacement body."),
  },
  risk: "write",
  profile: "core",
  summary: ({ peer, message_id }) => `edit ${message_id} in ${peer}`,
  async handler({ peer, message_id, text }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.editMessage(entity as never, { message: message_id, text });
      return { edited: true, id: message_id };
    });
  },
});

export const deleteMessage = defineTool({
  name: "delete",
  title: "Delete messages",
  description:
    "Delete one or more messages. This cannot be undone, and with revoke it removes them for everyone in the chat, not only for you.",
  schema: {
    peer: z.string().describe("The chat the messages are in."),
    message_ids: z.array(z.number()).describe("Ids to delete."),
    revoke: z.boolean().optional().describe("Delete for everyone, not just this account. Default true."),
    ...confirmArg,
  },
  risk: "destructive",
  profile: "core",
  summary: ({ peer, message_ids }) => `delete ${message_ids.length} message(s) in ${peer}`,
  async handler({ peer, message_ids, revoke }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.deleteMessages(entity as never, message_ids, { revoke: revoke !== false });
      return { deleted: message_ids.length };
    });
  },
});

export const markRead = defineTool({
  name: "mark_read",
  title: "Mark a chat read",
  description: "Clear the unread count on a chat.",
  schema: { peer: z.string().describe("The chat to mark read.") },
  risk: "write",
  profile: "core",
  summary: ({ peer }) => `mark ${peer} read`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.markAsRead(entity as never);
      return { read: true };
    });
  },
});

export const forward = defineTool({
  name: "forward",
  title: "Forward messages",
  description: "Forward messages from one chat into another.",
  schema: {
    from: z.string().describe("Chat to forward from."),
    to: z.string().describe("Chat to forward into."),
    message_ids: z.array(z.number()).describe("Ids to forward."),
  },
  risk: "write",
  profile: "core",
  summary: ({ from, to, message_ids }) => `forward ${message_ids.length} from ${from} to ${to}`,
  async handler({ from, to, message_ids }, ctx) {
    const fromEntity = await ctx.api.entity(from);
    const toEntity = await ctx.api.entity(to);
    return ctx.api.run(async (client) => {
      await client.forwardMessages(toEntity as never, {
        messages: message_ids,
        fromPeer: fromEntity as never,
      });
      return { forwarded: message_ids.length };
    });
  },
});

export const MESSAGE_TOOLS = [history, search, send, edit, deleteMessage, markRead, forward];
