/** Groups and channels: creating them, joining them, and running them. */

import { z } from "zod";
import { clamp, confirmArg, defineTool, selectArg } from "./kit.js";
import { displayName, page, sanitize, select } from "../format/render.js";

type Any = Record<string, unknown>;

const idOf = (e: Any) => String((e.id as { value?: unknown })?.value ?? e.id ?? "");

export const createGroup = defineTool({
  name: "create_group",
  title: "Create a group or channel",
  description:
    "Create a supergroup, a basic group, or a broadcast channel. One tool rather than three, because the only real difference is two flags.",
  schema: {
    title: z.string().describe("Name of the new chat."),
    kind: z
      .enum(["group", "channel"])
      .optional()
      .describe("group is a supergroup people talk in, channel broadcasts. Default group."),
    about: z.string().optional().describe("Description."),
    users: z.array(z.string()).optional().describe("Usernames or ids to add immediately."),
  },
  risk: "write",
  profile: "full",
  summary: ({ title, kind }) => `create ${kind ?? "group"} "${title}"`,
  async handler({ title, kind, about, users }, ctx) {
    const members = await Promise.all((users ?? []).map((u) => ctx.api.entity(u)));
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.channels.CreateChannel({
          title,
          about: about ?? "",
          megagroup: kind !== "channel",
          broadcast: kind === "channel",
        }),
      )) as unknown as { chats?: Any[] };
      const chat = (res.chats ?? [])[0] ?? {};
      if (members.length) {
        await client.invoke(
          new ctx.api.api.channels.InviteToChannel({
            channel: chat as never,
            users: members as never,
          }),
        );
      }
      return { created: true, id: idOf(chat), title: String(chat.title ?? title) };
    });
  },
});

export const joinChat = defineTool({
  name: "join_chat",
  title: "Join a chat",
  description:
    "Join a public group or channel by @username, or a private one by invite link. Both go through one tool because the caller usually has whichever they have.",
  schema: {
    target: z.string().describe("A @username, or a t.me invite link."),
  },
  risk: "write",
  profile: "full",
  summary: ({ target }) => `join ${target}`,
  async handler({ target }, ctx) {
    return ctx.api.run(async (client) => {
      const invite = target.match(/(?:joinchat\/|\+)([A-Za-z0-9_-]+)/);
      if (invite) {
        await client.invoke(new ctx.api.api.messages.ImportChatInvite({ hash: invite[1] as string }));
        return { joined: true, via: "invite link" };
      }
      const entity = await client.getEntity(target.replace(/^@/, "") as never);
      await client.invoke(new ctx.api.api.channels.JoinChannel({ channel: entity as never }));
      return { joined: true, via: "username", id: idOf(entity as unknown as Any) };
    });
  },
});

export const leaveChat = defineTool({
  name: "leave_chat",
  title: "Leave a chat",
  description: "Leave a group or channel. Rejoining a private one needs a fresh invite.",
  schema: { peer: z.string().describe("The chat to leave."), ...confirmArg },
  risk: "destructive",
  profile: "full",
  summary: ({ peer }) => `leave ${peer}`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(new ctx.api.api.channels.LeaveChannel({ channel: entity as never }));
      return { left: true };
    });
  },
});

export const getParticipants = defineTool({
  name: "get_participants",
  title: "List members of a chat",
  description:
    "Members of a group or channel. `filter` narrows to admins, banned or kicked, so this one tool replaces three.",
  schema: {
    peer: z.string().describe("The chat."),
    filter: z
      .enum(["all", "admins", "banned", "kicked", "bots"])
      .optional()
      .describe("Which members. Default all."),
    limit: z.number().optional().describe("How many. Default 50, max 500."),
    ...selectArg,
  },
  risk: "read",
  profile: "full",
  async handler({ peer, filter, limit, fields }, ctx) {
    const take = clamp(limit, 50, 500);
    const entity = await ctx.api.entity(peer);
    const rows = await ctx.api.run(async (client) => {
      const A = ctx.api.api;
      const f =
        filter === "admins"
          ? new A.ChannelParticipantsAdmins()
          : filter === "banned"
            ? new A.ChannelParticipantsBanned({ q: "" })
            : filter === "kicked"
              ? new A.ChannelParticipantsKicked({ q: "" })
              : filter === "bots"
                ? new A.ChannelParticipantsBots()
                : undefined;
      const people = await client.getParticipants(entity as never, {
        limit: take,
        ...(f ? { filter: f as never } : {}),
      });
      return people.map((u) => {
        const a = u as unknown as Any;
        return {
          id: idOf(a),
          name: displayName(a),
          username: a.username ? `@${String(a.username)}` : undefined,
          bot: a.bot ? true : undefined,
        };
      });
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const inviteToChat = defineTool({
  name: "invite_to_chat",
  title: "Add people to a chat",
  description: "Add one or more users to a group or channel you administer.",
  schema: {
    peer: z.string().describe("The chat."),
    users: z.array(z.string()).describe("Usernames or ids to add."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, users }) => `invite ${users.length} to ${peer}`,
  async handler({ peer, users }, ctx) {
    const entity = await ctx.api.entity(peer);
    const members = await Promise.all(users.map((u) => ctx.api.entity(u)));
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.channels.InviteToChannel({
          channel: entity as never,
          users: members as never,
        }),
      );
      return { invited: members.length };
    });
  },
});

export const inviteLink = defineTool({
  name: "invite_link",
  title: "Get or create an invite link",
  description: "The chat's primary invite link, creating one if there is none.",
  schema: { peer: z.string().describe("The chat.") },
  risk: "write",
  profile: "full",
  summary: ({ peer }) => `export invite link for ${peer}`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.ExportChatInvite({ peer: entity as never }),
      )) as unknown as Any;
      return { link: String(res.link ?? "") };
    });
  },
});

export const setAdmin = defineTool({
  name: "set_admin",
  title: "Promote or demote an admin",
  description:
    "Grant or remove admin rights. `promote: false` demotes, which is why this is one tool rather than two.",
  schema: {
    peer: z.string().describe("The chat."),
    user: z.string().describe("Who to promote or demote."),
    promote: z.boolean().optional().describe("True to promote, false to demote. Default true."),
    title: z.string().optional().describe("Custom admin title."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, user, promote }) =>
    `${promote === false ? "demote" : "promote"} ${user} in ${peer}`,
  async handler({ peer, user, promote, title }, ctx) {
    const entity = await ctx.api.entity(peer);
    const who = await ctx.api.entity(user);
    const on = promote !== false;
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.channels.EditAdmin({
          channel: entity as never,
          userId: who as never,
          adminRights: new ctx.api.api.ChatAdminRights({
            changeInfo: on,
            postMessages: on,
            editMessages: on,
            deleteMessages: on,
            banUsers: on,
            inviteUsers: on,
            pinMessages: on,
            addAdmins: false,
            manageCall: on,
          }),
          rank: title ?? "",
        }),
      );
      return { promoted: on };
    });
  },
});

export const setBanned = defineTool({
  name: "set_banned",
  title: "Ban or unban someone",
  description:
    "Ban a user from a chat, or lift it with `ban: false`. Banning removes them and stops them rejoining.",
  schema: {
    peer: z.string().describe("The chat."),
    user: z.string().describe("Who."),
    ban: z.boolean().optional().describe("True to ban, false to unban. Default true."),
    ...confirmArg,
  },
  risk: "destructive",
  profile: "full",
  summary: ({ peer, user, ban }) => `${ban === false ? "unban" : "ban"} ${user} in ${peer}`,
  async handler({ peer, user, ban }, ctx) {
    const entity = await ctx.api.entity(peer);
    const who = await ctx.api.entity(user);
    const on = ban !== false;
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.channels.EditBanned({
          channel: entity as never,
          participant: who as never,
          bannedRights: new ctx.api.api.ChatBannedRights({
            untilDate: 0,
            viewMessages: on,
            sendMessages: on,
            sendMedia: on,
          }),
        }),
      );
      return { banned: on };
    });
  },
});

export const editChat = defineTool({
  name: "edit_chat",
  title: "Change a chat's title or description",
  description:
    "Rename a chat or change its description. Both in one tool, because they are the same kind of edit.",
  schema: {
    peer: z.string().describe("The chat."),
    title: z.string().optional().describe("New title."),
    about: z.string().optional().describe("New description."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer }) => `edit ${peer}`,
  async handler({ peer, title, about }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const done: string[] = [];
      if (title !== undefined) {
        await client.invoke(
          new ctx.api.api.channels.EditTitle({ channel: entity as never, title }),
        );
        done.push("title");
      }
      if (about !== undefined) {
        await client.invoke(
          new ctx.api.api.messages.EditChatAbout({ peer: entity as never, about }),
        );
        done.push("about");
      }
      return { changed: done };
    });
  },
});

export const getFullChat = defineTool({
  name: "get_full_chat",
  title: "Full details of a chat",
  description:
    "Everything about one chat: description, member count, pinned message id, and whether you can post.",
  schema: { peer: z.string().describe("The chat.") },
  risk: "read",
  profile: "full",
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.channels.GetFullChannel({ channel: entity as never }),
      )) as unknown as { fullChat?: Any; chats?: Any[] };
      const full = res.fullChat ?? {};
      const chat = (res.chats ?? [])[0] ?? {};
      return {
        id: idOf(chat),
        title: String(chat.title ?? ""),
        about: sanitize(String(full.about ?? "")) || undefined,
        participants: Number(full.participantsCount ?? 0) || undefined,
        pinned_message: Number(full.pinnedMsgId ?? 0) || undefined,
        slow_mode: Number(full.slowmodeSeconds ?? 0) || undefined,
      };
    });
  },
});

export const GROUP_TOOLS = [
  createGroup,
  joinChat,
  leaveChat,
  getParticipants,
  inviteToChat,
  inviteLink,
  setAdmin,
  setBanned,
  editChat,
  getFullChat,
];
