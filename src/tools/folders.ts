/** Chat folders, and the contacts import and export pair. */

import { z } from "zod";
import { confirmArg, defineTool, type ToolContext } from "./kit.js";
import { displayName, page, sanitize } from "../format/render.js";

type Any = Record<string, unknown>;

/** Read the current filter list, since every write has to send back a whole filter. */
async function filters(ctx: ToolContext): Promise<Any[]> {
  return ctx.api.run(async (client) => {
    const res = (await client.invoke(
      new ctx.api.api.messages.GetDialogFilters(),
    )) as unknown as { filters?: Any[] } | Any[];
    return Array.isArray(res) ? res : (res.filters ?? []);
  });
}

export const createFolder = defineTool({
  name: "create_folder",
  title: "Create a chat folder",
  description:
    "Make a new folder and put chats in it. Telegram calls these dialog filters.",
  schema: {
    title: z.string().describe("Folder name."),
    peers: z.array(z.string()).optional().describe("Chats to include."),
  },
  risk: "write",
  profile: "full",
  summary: ({ title }) => `create folder "${title}"`,
  async handler({ title, peers }, ctx) {
    const included = await Promise.all((peers ?? []).map((p) => ctx.api.entity(p)));
    const existing = await filters(ctx);
    // Filter ids are chosen by the client, and 0 and 1 are reserved for the
    // default and archive views, so start at 2 and take the first gap.
    const used = new Set(existing.map((f) => Number(f.id ?? 0)));
    let id = 2;
    while (used.has(id)) id += 1;
    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      await client.invoke(
        new A.messages.UpdateDialogFilter({
          id,
          filter: new A.DialogFilter({
            id,
            title: new A.TextWithEntities({ text: title, entities: [] }) as never,
            pinnedPeers: [] as never,
            includePeers: included as never,
            excludePeers: [] as never,
          }) as never,
        }),
      );
      return { created: true, id, title, included: included.length };
    });
  },
});

export const updateFolder = defineTool({
  name: "update_folder",
  title: "Rename a folder or change what is in it",
  description:
    "Rename a folder, or add and remove chats. Anything omitted is left as it is, so this covers add_chat_to_folder and remove_chat_from_folder too.",
  schema: {
    id: z.number().describe("Folder id, from list_folders."),
    title: z.string().optional().describe("New name."),
    add: z.array(z.string()).optional().describe("Chats to add."),
    remove: z.array(z.string()).optional().describe("Chats to remove."),
  },
  risk: "write",
  profile: "full",
  summary: ({ id }) => `update folder ${id}`,
  async handler({ id, title, add, remove }, ctx) {
    const existing = await filters(ctx);
    const current = existing.find((f) => Number(f.id ?? 0) === id);
    if (!current) return { updated: false, reason: `no folder with id ${id}` };

    const toAdd = await Promise.all((add ?? []).map((p) => ctx.api.entity(p)));
    const removeIds = new Set(
      (await Promise.all((remove ?? []).map((p) => ctx.api.entity(p)))).map((e) =>
        String((e as unknown as Any).id ?? ""),
      ),
    );
    const kept = ((current.includePeers as Any[]) ?? []).filter(
      (p) => !removeIds.has(String(p.userId ?? p.channelId ?? p.chatId ?? "")),
    );

    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      await client.invoke(
        new A.messages.UpdateDialogFilter({
          id,
          filter: new A.DialogFilter({
            id,
            title:
              title !== undefined
                ? (new A.TextWithEntities({ text: title, entities: [] }) as never)
                : (current.title as never),
            pinnedPeers: (current.pinnedPeers ?? []) as never,
            includePeers: [...kept, ...toAdd] as never,
            excludePeers: (current.excludePeers ?? []) as never,
          }) as never,
        }),
      );
      return { updated: true, id, added: toAdd.length, removed: removeIds.size };
    });
  },
});

export const deleteFolder = defineTool({
  name: "delete_folder",
  title: "Delete a chat folder",
  description: "Remove a folder. The chats in it are not touched, only the folder.",
  schema: { id: z.number().describe("Folder id, from list_folders."), ...confirmArg },
  risk: "destructive",
  profile: "full",
  summary: ({ id }) => `delete folder ${id}`,
  async handler({ id }, ctx) {
    return ctx.api.run(async (client) => {
      await client.invoke(new ctx.api.api.messages.UpdateDialogFilter({ id }));
      return { deleted: true, id };
    });
  },
});

export const reorderFolders = defineTool({
  name: "reorder_folders",
  title: "Reorder chat folders",
  description: "Set the left-to-right order of your folders.",
  schema: { order: z.array(z.number()).describe("Folder ids, in the order you want them.") },
  risk: "write",
  profile: "full",
  summary: ({ order }) => `reorder ${order.length} folders`,
  async handler({ order }, ctx) {
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.UpdateDialogFiltersOrder({ order }),
      );
      return { reordered: order.length };
    });
  },
});

export const importContacts = defineTool({
  name: "import_contacts",
  title: "Import contacts in bulk",
  description: "Add several people to your address book at once, by phone number.",
  schema: {
    contacts: z
      .array(
        z.object({
          phone: z.string().describe("Phone number, international format."),
          first_name: z.string().describe("First name."),
          last_name: z.string().optional().describe("Last name."),
        }),
      )
      .describe("People to add."),
  },
  risk: "write",
  profile: "full",
  summary: ({ contacts }) => `import ${contacts.length} contacts`,
  async handler({ contacts }, ctx) {
    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      const res = (await client.invoke(
        new A.contacts.ImportContacts({
          contacts: contacts.map(
            (c, i) =>
              new A.InputPhoneContact({
                clientId: BigInt(i) as never,
                phone: c.phone,
                firstName: c.first_name,
                lastName: c.last_name ?? "",
              }),
          ) as never,
        }),
      )) as unknown as { imported?: Any[]; retryContacts?: unknown[] };
      return {
        imported: (res.imported ?? []).length,
        not_on_telegram: contacts.length - (res.imported ?? []).length,
      };
    });
  },
});

export const exportContacts = defineTool({
  name: "export_contacts",
  title: "Export every contact",
  description:
    "Your whole address book with phone numbers, for backing up or moving elsewhere.",
  schema: {},
  risk: "read",
  profile: "full",
  async handler(_args, ctx) {
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.contacts.GetContacts({ hash: 0 as never }),
      )) as unknown as { users?: Any[] };
      return (res.users ?? []).map((u) => ({
        id: String((u.id as { value?: unknown })?.value ?? u.id ?? ""),
        name: displayName(u),
        username: u.username ? `@${String(u.username)}` : undefined,
        phone: u.phone ? `+${String(u.phone)}` : undefined,
      }));
    });
    return page(rows);
  },
});

export const setPrivacy = defineTool({
  name: "set_privacy",
  title: "Change a privacy setting",
  description:
    "Set who can see your phone number, last seen, photo, or add you to groups.",
  schema: {
    key: z
      .enum(["phone", "last_seen", "profile_photo", "forwards", "chat_invite", "calls"])
      .describe("Which setting."),
    allow: z
      .enum(["everybody", "contacts", "nobody"])
      .describe("Who is allowed."),
  },
  risk: "write",
  profile: "full",
  summary: ({ key, allow }) => `set privacy ${key} to ${allow}`,
  async handler({ key, allow }, ctx) {
    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      const keys: Record<string, unknown> = {
        phone: new A.InputPrivacyKeyPhoneNumber(),
        last_seen: new A.InputPrivacyKeyStatusTimestamp(),
        profile_photo: new A.InputPrivacyKeyProfilePhoto(),
        forwards: new A.InputPrivacyKeyForwards(),
        chat_invite: new A.InputPrivacyKeyChatInvite(),
        calls: new A.InputPrivacyKeyPhoneCall(),
      };
      const rules =
        allow === "everybody"
          ? [new A.InputPrivacyValueAllowAll()]
          : allow === "contacts"
            ? [new A.InputPrivacyValueAllowContacts()]
            : [new A.InputPrivacyValueDisallowAll()];
      await client.invoke(
        new A.account.SetPrivacy({ key: keys[key] as never, rules: rules as never }),
      );
      return { key, allow };
    });
  },
});

export const getFolder = defineTool({
  name: "get_folder",
  title: "One folder's contents",
  description: "What is in a single chat folder.",
  schema: { id: z.number().describe("Folder id, from list_folders.") },
  risk: "read",
  profile: "full",
  async handler({ id }, ctx) {
    const all = await filters(ctx);
    const f = all.find((x) => Number(x.id ?? 0) === id);
    if (!f) return { found: false };
    return {
      id,
      title: sanitize(String((f.title as Any)?.text ?? f.title ?? "")),
      included: ((f.includePeers as Any[]) ?? []).length,
      excluded: ((f.excludePeers as Any[]) ?? []).length,
      pinned: ((f.pinnedPeers as Any[]) ?? []).length,
    };
  },
});

export const FOLDER_TOOLS = [
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
  importContacts,
  exportContacts,
  setPrivacy,
];
