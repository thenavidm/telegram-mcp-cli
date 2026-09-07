/** Who this session is, and whether it still works. */

import { z } from "zod";
import { defineTool } from "./kit.js";
import { displayName } from "../format/render.js";

export const whoami = defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "The Telegram account this session is signed in as. Call it first when it matters whose messages you are about to read or send.",
  schema: {},
  risk: "read",
  profile: "core",
  async handler(_args, ctx) {
    return ctx.api.run(async (client) => {
      const me = (await client.getMe()) as unknown as Record<string, unknown>;
      return {
        id: String((me.id as { value?: unknown })?.value ?? me.id ?? ""),
        name: displayName(me),
        username: me.username ? `@${String(me.username)}` : undefined,
        phone: me.phone ? `+${String(me.phone)}` : undefined,
        premium: Boolean(me.premium),
      };
    });
  },
});

export const resolve = defineTool({
  name: "resolve",
  title: "Resolve a username or id",
  description:
    "Turn a @username, phone number or numeric id into a chat you can act on. Use it before sending to someone you only know by handle.",
  schema: {
    peer: z.string().describe("A @username, phone number, numeric id, or 'me'."),
  },
  risk: "read",
  profile: "core",
  async handler({ peer }, ctx) {
    const entity = (await ctx.api.entity(peer)) as unknown as Record<string, unknown>;
    return {
      id: String((entity.id as { value?: unknown })?.value ?? entity.id ?? ""),
      name: displayName(entity),
      username: entity.username ? `@${String(entity.username)}` : undefined,
      kind: entity.className === "User" ? (entity.bot ? "bot" : "user") : "chat",
    };
  },
});

export const ACCOUNT_TOOLS = [whoami, resolve];
