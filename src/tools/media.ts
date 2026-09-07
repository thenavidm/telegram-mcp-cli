/** Media: getting files out of Telegram and putting them back in. */

import { resolve as resolvePath } from "node:path";
import { z } from "zod";
import { defineTool } from "./kit.js";
import { TelegramError } from "../api/errors.js";

export const downloadMedia = defineTool({
  name: "download_media",
  title: "Download media from a message",
  description:
    "Save the photo, video, document or voice note attached to a message, and return the local path. The file is written to disk rather than returned inline, because a base64 image in a tool result is enormous and unreadable.",
  schema: {
    peer: z.string().describe("The chat the message is in."),
    message_id: z.number().describe("Id of the message carrying the media."),
    dir: z.string().optional().describe("Directory to save into. Defaults to the working directory."),
  },
  risk: "read",
  profile: "core",
  async handler({ peer, message_id, dir }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const [message] = await client.getMessages(entity as never, { ids: [message_id] });
      if (!message) throw new TelegramError("NOT_FOUND", `No message ${message_id} in that chat.`);
      if (!(message as unknown as { media?: unknown }).media) {
        throw new TelegramError("NOT_FOUND", `Message ${message_id} has no media attached.`);
      }
      const target = resolvePath(dir ?? process.cwd());
      const path = await client.downloadMedia(message as never, { outputFile: target });
      return { saved: true, path: String(path ?? target) };
    });
  },
});

export const sendFile = defineTool({
  name: "send_file",
  title: "Send a file",
  description: "Send a local file to a chat, with an optional caption.",
  schema: {
    peer: z.string().describe("A @username, numeric id, or 'me'."),
    path: z.string().describe("Absolute path to the file to send."),
    caption: z.string().optional().describe("Caption to attach."),
  },
  risk: "write",
  profile: "core",
  summary: ({ peer, path }) => `send file ${path} to ${peer}`,
  async handler({ peer, path, caption }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.sendFile(entity as never, {
        file: resolvePath(path),
        ...(caption ? { caption } : {}),
      });
      return { sent: true };
    });
  },
});

export const MEDIA_TOOLS = [downloadMedia, sendFile];
