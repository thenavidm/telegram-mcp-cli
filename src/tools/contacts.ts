/** Contacts: who you know, and who you have blocked. */

import { z } from "zod";
import { clamp, confirmArg, defineTool, selectArg } from "./kit.js";
import { displayName, page, sanitize, select } from "../format/render.js";

type Any = Record<string, unknown>;

const contactRow = (u: Any) => ({
  id: String((u.id as { value?: unknown })?.value ?? u.id ?? ""),
  name: displayName(u),
  username: u.username ? `@${String(u.username)}` : undefined,
  phone: u.phone ? `+${String(u.phone)}` : undefined,
  bot: u.bot ? true : undefined,
  mutual: u.mutualContact ? true : undefined,
});

export const listContacts = defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: "Everyone in your Telegram address book, as flat rows.",
  schema: {
    limit: z.number().optional().describe("How many. Default 50, max 500."),
    ...selectArg,
  },
  risk: "read",
  profile: "full",
  async handler({ limit, fields }, ctx) {
    const take = clamp(limit, 50, 500);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.contacts.GetContacts({ hash: 0 as never }),
      )) as unknown as { users?: Any[] };
      return (res.users ?? []).slice(0, take).map(contactRow);
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const searchContacts = defineTool({
  name: "search_contacts",
  title: "Search contacts and users",
  description:
    "Search your contacts and Telegram's public directory by name or username. Use it when you know who but not their handle.",
  schema: {
    query: z.string().describe("Name or username fragment."),
    limit: z.number().optional().describe("How many. Default 20, max 100."),
    ...selectArg,
  },
  risk: "read",
  profile: "full",
  async handler({ query, limit, fields }, ctx) {
    const take = clamp(limit, 20, 100);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.contacts.Search({ q: query, limit: take }),
      )) as unknown as { users?: Any[] };
      return (res.users ?? []).map(contactRow);
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const addContact = defineTool({
  name: "add_contact",
  title: "Add a contact",
  description: "Save someone to your address book.",
  schema: {
    peer: z.string().describe("A @username or numeric id."),
    first_name: z.string().describe("First name to file them under."),
    last_name: z.string().optional().describe("Last name."),
    phone: z.string().optional().describe("Phone number, if you have it."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, first_name }) => `add contact ${first_name} (${peer})`,
  async handler({ peer, first_name, last_name, phone }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.contacts.AddContact({
          id: entity as never,
          firstName: first_name,
          lastName: last_name ?? "",
          phone: phone ?? "",
          addPhonePrivacyException: false,
        }),
      );
      return { added: true };
    });
  },
});

export const deleteContact = defineTool({
  name: "delete_contact",
  title: "Remove a contact",
  description:
    "Remove someone from your address book. It does not block them or delete any messages.",
  schema: { peer: z.string().describe("A @username or numeric id."), ...confirmArg },
  risk: "destructive",
  profile: "full",
  summary: ({ peer }) => `remove contact ${peer}`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(new ctx.api.api.contacts.DeleteContacts({ id: [entity] as never }));
      return { removed: true };
    });
  },
});

export const blockUser = defineTool({
  name: "block",
  title: "Block someone",
  description: "Block a user. They can no longer message you.",
  schema: { peer: z.string().describe("A @username or numeric id.") },
  risk: "write",
  profile: "full",
  summary: ({ peer }) => `block ${peer}`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(new ctx.api.api.contacts.Block({ id: entity as never }));
      return { blocked: true };
    });
  },
});

export const unblockUser = defineTool({
  name: "unblock",
  title: "Unblock someone",
  description: "Reverse a block.",
  schema: { peer: z.string().describe("A @username or numeric id.") },
  risk: "write",
  profile: "full",
  summary: ({ peer }) => `unblock ${peer}`,
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(new ctx.api.api.contacts.Unblock({ id: entity as never }));
      return { unblocked: true };
    });
  },
});

export const listBlocked = defineTool({
  name: "list_blocked",
  title: "List blocked users",
  description: "Everyone you have blocked.",
  schema: { limit: z.number().optional().describe("How many. Default 50, max 200.") },
  risk: "read",
  profile: "full",
  async handler({ limit }, ctx) {
    const take = clamp(limit, 50, 200);
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.contacts.GetBlocked({ offset: 0, limit: take }),
      )) as unknown as { users?: Any[] };
      return (res.users ?? []).map(contactRow);
    });
    return page(rows);
  },
});

export const getUser = defineTool({
  name: "get_user",
  title: "Get a user's profile",
  description: "Public profile of one user: name, username, bio and status.",
  schema: { peer: z.string().describe("A @username or numeric id.") },
  risk: "read",
  profile: "full",
  async handler({ peer }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const full = (await client.invoke(
        new ctx.api.api.users.GetFullUser({ id: entity as never }),
      )) as unknown as { fullUser?: Any; users?: Any[] };
      const u = (full.users ?? [])[0] ?? {};
      return {
        ...contactRow(u),
        bio: sanitize(String((full.fullUser as Any)?.about ?? "")) || undefined,
        common_chats: Number((full.fullUser as Any)?.commonChatsCount ?? 0) || undefined,
      };
    });
  },
});

export const CONTACT_TOOLS = [
  listContacts,
  searchContacts,
  getUser,
  addContact,
  deleteContact,
  blockUser,
  unblockUser,
  listBlocked,
];
