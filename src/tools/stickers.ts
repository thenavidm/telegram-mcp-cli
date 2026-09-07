/** Stickers, GIFs, albums, and the other ways to send something that is not text. */

import { resolve as resolvePath } from "node:path";
import { z } from "zod";
import { clamp, defineTool, selectArg } from "./kit.js";
import { page, sanitize, select } from "../format/render.js";

type Any = Record<string, unknown>;

export const listStickerSets = defineTool({
  name: "list_sticker_sets",
  title: "List your sticker sets",
  description: "Sticker packs installed on this account.",
  schema: { ...selectArg },
  risk: "read",
  profile: "full",
  async handler({ fields }, ctx) {
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.GetAllStickers({ hash: 0 as never }),
      )) as unknown as { sets?: Any[] };
      return (res.sets ?? []).map((s) => ({
        id: String((s.id as { value?: unknown })?.value ?? s.id ?? ""),
        name: sanitize(String(s.title ?? "")),
        short_name: String(s.shortName ?? ""),
        count: Number(s.count ?? 0),
      }));
    });
    return page(select(rows as unknown as Any[], fields));
  },
});

export const searchGifs = defineTool({
  name: "search_gifs",
  title: "Search GIFs",
  description: "Search Telegram's GIF catalogue. Returns ids you can pass to send_gif.",
  schema: {
    query: z.string().describe("What to search for."),
    limit: z.number().optional().describe("How many. Default 10, max 50."),
  },
  risk: "read",
  profile: "full",
  async handler({ query, limit }, ctx) {
    const take = clamp(limit, 10, 50);
    return ctx.api.run(async (client) => {
      const bot = await client.getEntity("gif" as never);
      const res = (await client.invoke(
        new ctx.api.api.messages.GetInlineBotResults({
          bot: bot as never,
          peer: (await client.getEntity("me" as never)) as never,
          query,
          offset: "",
        }),
      )) as unknown as { results?: Any[] };
      return page(
        (res.results ?? []).slice(0, take).map((r) => ({
          id: String(r.id ?? ""),
          query_id: String((res as Any).queryId ?? ""),
          type: String(r.type ?? ""),
        })),
      );
    });
  },
});

export const sendSticker = defineTool({
  name: "send_sticker",
  title: "Send a sticker or GIF",
  description:
    "Send a sticker or an animated GIF from a local file. One tool for both, because Telegram treats them as the same kind of document.",
  schema: {
    peer: z.string().describe("The chat."),
    path: z.string().describe("Absolute path to the .webp, .tgs or .gif file."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, path }) => `send sticker ${path} to ${peer}`,
  async handler({ peer, path }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.sendFile(entity as never, { file: resolvePath(path) });
      return { sent: true };
    });
  },
});

export const sendAlbum = defineTool({
  name: "send_album",
  title: "Send several photos as one album",
  description:
    "Send multiple images or videos as a single grouped album rather than separate messages.",
  schema: {
    peer: z.string().describe("The chat."),
    paths: z.array(z.string()).describe("Absolute paths, 2 to 10 files."),
    caption: z.string().optional().describe("Caption for the album."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, paths }) => `send album of ${paths.length} to ${peer}`,
  async handler({ peer, paths, caption }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.sendFile(entity as never, {
        file: paths.map((p) => resolvePath(p)) as never,
        ...(caption ? { caption } : {}),
      });
      return { sent: true, files: paths.length };
    });
  },
});

export const sendContact = defineTool({
  name: "send_contact",
  title: "Share a contact card",
  description: "Send someone's phone number as a Telegram contact card.",
  schema: {
    peer: z.string().describe("Who to send it to."),
    phone: z.string().describe("Phone number to share."),
    first_name: z.string().describe("First name on the card."),
    last_name: z.string().optional().describe("Last name."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, first_name }) => `send contact ${first_name} to ${peer}`,
  async handler({ peer, phone, first_name, last_name }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.messages.SendMedia({
          peer: entity as never,
          message: "",
          media: new ctx.api.api.InputMediaContact({
            phoneNumber: phone,
            firstName: first_name,
            lastName: last_name ?? "",
            vcard: "",
          }) as never,
          randomId: BigInt(Math.floor(Math.random() * 1e18)) as never,
        }),
      );
      return { sent: true };
    });
  },
});

export const transcribe = defineTool({
  name: "transcribe_voice",
  title: "Transcribe a voice message",
  description:
    "Ask Telegram to transcribe a voice note or video note. This uses Telegram's own transcription, which needs Premium on the account. Nothing is sent to a third party.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("The voice or video note."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, message_id }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.messages.TranscribeAudio({
          peer: entity as never,
          msgId: message_id,
        }),
      )) as unknown as Any;
      return {
        text: sanitize(String(res.text ?? "")),
        pending: res.pending ? true : undefined,
      };
    });
  },
});

export const STICKER_TOOLS = [
  listStickerSets,
  searchGifs,
  sendSticker,
  sendAlbum,
  sendContact,
  transcribe,
];
