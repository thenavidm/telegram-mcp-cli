/** Pins, reactions, polls and scheduled messages. */

import { z } from "zod";
import { clamp, confirmArg, defineTool, selectArg } from "./kit.js";
import { messageRow, page, select } from "../format/render.js";

type Any = Record<string, unknown>;

export const pin = defineTool({
  name: "pin",
  title: "Pin or unpin a message",
  description:
    "Pin a message in a chat, or unpin it with `pin: false`. One tool, because unpinning is the same call with a flag.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("Message to pin or unpin."),
    pin: z.boolean().optional().describe("True to pin, false to unpin. Default true."),
    silent: z.boolean().optional().describe("Pin without notifying everyone."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, message_id, pin }) =>
    `${pin === false ? "unpin" : "pin"} ${message_id} in ${peer}`,
  async handler({ peer, message_id, pin, silent }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.UpdatePinnedMessage({
          peer: entity as never,
          id: message_id,
          unpin: pin === false,
          silent: silent === true,
        }),
      );
      return { pinned: pin !== false };
    });
  },
});

export const getPinned = defineTool({
  name: "get_pinned",
  title: "List pinned messages",
  description: "Every pinned message in a chat.",
  schema: {
    peer: z.string().describe("The chat."),
    limit: z.number().optional().describe("How many. Default 20, max 100."),
    ...selectArg,
  },
  risk: "read",
  profile: "full",
  async handler({ peer, limit, fields }, ctx) {
    const take = clamp(limit, 20, 100);
    const entity = await ctx.api.entity(peer);
    const rows = await ctx.api.run(async (client) => {
      const msgs = await client.getMessages(entity as never, {
        limit: take,
        filter: new ctx.api.api.InputMessagesFilterPinned() as never,
      });
      return msgs.map((m) => messageRow(m as unknown as Any));
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const react = defineTool({
  name: "react",
  title: "React to a message",
  description:
    "Add an emoji reaction, or clear your reactions by passing no emoji. Clearing is the same call with an empty list.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("Message to react to."),
    emoji: z.string().optional().describe("The emoji, for example 👍. Omit to remove your reaction."),
    big: z.boolean().optional().describe("Play the large animation."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, message_id, emoji }) =>
    `react ${emoji ?? "(clear)"} to ${message_id} in ${peer}`,
  async handler({ peer, message_id, emoji, big }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.SendReaction({
          peer: entity as never,
          msgId: message_id,
          big: big === true,
          reaction: emoji
            ? ([new ctx.api.api.ReactionEmoji({ emoticon: emoji })] as never)
            : ([] as never),
        }),
      );
      return { reacted: Boolean(emoji) };
    });
  },
});

export const getReactions = defineTool({
  name: "get_reactions",
  title: "Who reacted to a message",
  description: "The reactions on a message and who left them.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("The message."),
    limit: z.number().optional().describe("How many reactors. Default 50, max 100."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, message_id, limit }, ctx) {
    const take = clamp(limit, 50, 100);
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetMessageReactionsList({
          peer: entity as never,
          id: message_id,
          limit: take,
        }),
      )) as unknown as { count?: number; reactions?: Any[] };
      return {
        count: Number(res.count ?? 0),
        reactions: (res.reactions ?? []).map((r) => ({
          emoji: String((r.reaction as Any)?.emoticon ?? ""),
          user: String((r.peerId as Any)?.userId ?? ""),
        })),
      };
    });
  },
});

export const createPoll = defineTool({
  name: "create_poll",
  title: "Send a poll",
  description: "Post a poll to a chat.",
  schema: {
    peer: z.string().describe("The chat."),
    question: z.string().describe("The question."),
    options: z.array(z.string()).describe("Answer options, 2 to 10."),
    multiple: z.boolean().optional().describe("Allow more than one answer."),
    anonymous: z.boolean().optional().describe("Hide who voted. Default true."),
    quiz_answer: z
      .number()
      .optional()
      .describe("Index of the correct option. Setting this makes it a quiz."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, question }) => `poll in ${peer}: ${question.slice(0, 50)}`,
  async handler({ peer, question, options, multiple, anonymous, quiz_answer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      const answers = options.map(
        (text, i) => new A.PollAnswer({ text: new A.TextWithEntities({ text, entities: [] }) as never, option: Buffer.from([i]) }),
      );
      await client.invoke(
        new A.messages.SendMedia({
          peer: entity as never,
          message: "",
          media: new A.InputMediaPoll({
            poll: new A.Poll({
              id: BigInt(Date.now()) as never,
              question: new A.TextWithEntities({ text: question, entities: [] }) as never,
              answers: answers as never,
              multipleChoice: multiple === true,
              publicVoters: anonymous === false,
              quiz: quiz_answer !== undefined,
            }),
            ...(quiz_answer !== undefined
              ? { correctAnswers: [Buffer.from([quiz_answer])] as never }
              : {}),
          }) as never,
          randomId: BigInt(Math.floor(Math.random() * 1e18)) as never,
        }),
      );
      return { sent: true, options: options.length };
    });
  },
});

export const getScheduled = defineTool({
  name: "get_scheduled",
  title: "List scheduled messages",
  description: "Messages queued to send later in a chat.",
  schema: { peer: z.string().describe("The chat."), ...selectArg },
  risk: "read",
  profile: "full",
  async handler({ peer, fields }, ctx) {
    const entity = await ctx.api.entity(peer);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetScheduledHistory({ peer: entity as never, hash: 0 as never }),
      )) as unknown as { messages?: Any[] };
      return (res.messages ?? []).map((m) => messageRow(m));
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const deleteScheduled = defineTool({
  name: "delete_scheduled",
  title: "Cancel scheduled messages",
  description: "Remove messages queued to send later, before they go out.",
  schema: {
    peer: z.string().describe("The chat."),
    message_ids: z.array(z.number()).describe("Scheduled message ids to cancel."),
    ...confirmArg,
  },
  risk: "destructive",
  profile: "full",
  summary: ({ peer, message_ids }) => `cancel ${message_ids.length} scheduled in ${peer}`,
  async handler({ peer, message_ids }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.DeleteScheduledMessages({
          peer: entity as never,
          id: message_ids,
        }),
      );
      return { cancelled: message_ids.length };
    });
  },
});

export const messageLink = defineTool({
  name: "message_link",
  title: "Get a link to a message",
  description: "A t.me link to one message, for quoting it somewhere else.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("The message."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, message_id }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.channels.ExportMessageLink({
          channel: entity as never,
          id: message_id,
        }),
      )) as unknown as Any;
      return { link: String(res.link ?? "") };
    });
  },
});

export const ENGAGE_TOOLS = [
  pin,
  getPinned,
  react,
  getReactions,
  createPoll,
  getScheduled,
  deleteScheduled,
  messageLink,
];
