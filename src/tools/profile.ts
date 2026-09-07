/** Your own account: profile, photos, privacy, and media you send. */

import { resolve as resolvePath } from "node:path";
import { z } from "zod";
import { clamp, confirmArg, defineTool } from "./kit.js";
import { page, sanitize } from "../format/render.js";

type Any = Record<string, unknown>;

export const updateProfile = defineTool({
  name: "update_profile",
  title: "Update your profile",
  description:
    "Change your first name, last name or bio. Anything left out is untouched, so this replaces three separate tools.",
  schema: {
    first_name: z.string().optional().describe("New first name."),
    last_name: z.string().optional().describe("New last name."),
    bio: z.string().optional().describe("New bio, up to 70 characters."),
  },
  risk: "write",
  profile: "full",
  summary: (a) => `update profile: ${Object.keys(a).join(", ")}`,
  async handler({ first_name, last_name, bio }, ctx) {
    return ctx.api.run(async (client) => {
      await client.invoke(
        new ctx.api.api.account.UpdateProfile({
          ...(first_name !== undefined ? { firstName: first_name } : {}),
          ...(last_name !== undefined ? { lastName: last_name } : {}),
          ...(bio !== undefined ? { about: bio } : {}),
        }),
      );
      return { updated: true };
    });
  },
});

export const setProfilePhoto = defineTool({
  name: "set_profile_photo",
  title: "Set your profile photo",
  description: "Upload a local image as your profile picture.",
  schema: { path: z.string().describe("Absolute path to the image.") },
  risk: "write",
  profile: "full",
  summary: ({ path }) => `set profile photo from ${path}`,
  async handler({ path }, ctx) {
    return ctx.api.run(async (client) => {
      const file = await client.uploadFile({
        file: resolvePath(path) as never,
        workers: 1,
      });
      await client.invoke(
        new ctx.api.api.photos.UploadProfilePhoto({ file: file as never }),
      );
      return { updated: true };
    });
  },
});

export const listProfilePhotos = defineTool({
  name: "list_profile_photos",
  title: "List profile photos",
  description: "Profile pictures on an account, yours or someone else's.",
  schema: {
    peer: z.string().optional().describe("Whose. Defaults to you."),
    limit: z.number().optional().describe("How many. Default 20, max 100."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, limit }, ctx) {
    const take = clamp(limit, 20, 100);
    const entity = await ctx.api.entity(peer ?? "me");
    const rows = await ctx.api.run(async (client) => {
      const res = (await client.invoke(
        new ctx.api.api.photos.GetUserPhotos({
          userId: entity as never,
          offset: 0,
          maxId: 0 as never,
          limit: take,
        }),
      )) as unknown as { photos?: Any[] };
      return (res.photos ?? []).map((p) => ({
        id: String((p.id as { value?: unknown })?.value ?? p.id ?? ""),
        date: p.date ? new Date(Number(p.date) * 1000).toISOString() : undefined,
      }));
    });
    return page(rows);
  },
});

export const deleteProfilePhoto = defineTool({
  name: "delete_profile_photo",
  title: "Delete your current profile photo",
  description: "Remove the profile picture currently showing. Cannot be undone.",
  schema: { ...confirmArg },
  risk: "destructive",
  profile: "full",
  summary: () => "delete current profile photo",
  async handler(_args, ctx) {
    return ctx.api.run(async (client) => {
      const me = (await client.getMe()) as unknown as Any;
      const photo = me.photo as Any | undefined;
      if (!photo) return { deleted: false, reason: "no profile photo set" };
      await client.invoke(
        new ctx.api.api.photos.DeletePhotos({
          id: [
            new ctx.api.api.InputPhoto({
              id: photo.photoId as never,
              accessHash: (photo.dcId ?? 0) as never,
              fileReference: Buffer.alloc(0),
            }),
          ] as never,
        }),
      );
      return { deleted: true };
    });
  },
});

export const getPrivacy = defineTool({
  name: "get_privacy",
  title: "Read your privacy settings",
  description: "Who can see your phone number, last seen, photo, or add you to groups.",
  schema: {
    key: z
      .enum(["phone", "last_seen", "profile_photo", "forwards", "chat_invite", "calls"])
      .describe("Which setting to read."),
  },
  risk: "read",
  profile: "full",
  async handler({ key }, ctx) {
    return ctx.api.run(async (client) => {
      const A = ctx.api.api;
      const map: Record<string, unknown> = {
        phone: new A.InputPrivacyKeyPhoneNumber(),
        last_seen: new A.InputPrivacyKeyStatusTimestamp(),
        profile_photo: new A.InputPrivacyKeyProfilePhoto(),
        forwards: new A.InputPrivacyKeyForwards(),
        chat_invite: new A.InputPrivacyKeyChatInvite(),
        calls: new A.InputPrivacyKeyPhoneCall(),
      };
      const res = (await client.invoke(
        new A.account.GetPrivacy({ key: map[key] as never }),
      )) as unknown as { rules?: Any[] };
      return {
        key,
        rules: (res.rules ?? []).map((r) => String(r.className ?? "").replace(/^PrivacyValue/, "")),
      };
    });
  },
});

export const sendVoice = defineTool({
  name: "send_voice",
  title: "Send a voice note",
  description: "Send an audio file as a voice message rather than a file attachment.",
  schema: {
    peer: z.string().describe("The chat."),
    path: z.string().describe("Absolute path to the audio file."),
  },
  risk: "write",
  profile: "full",
  summary: ({ peer, path }) => `send voice note to ${peer} from ${path}`,
  async handler({ peer, path }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      await client.sendFile(entity as never, {
        file: resolvePath(path),
        voiceNote: true,
      });
      return { sent: true };
    });
  },
});

export const mediaInfo = defineTool({
  name: "media_info",
  title: "Describe a message's media",
  description:
    "What is attached to a message: kind, size, mime type and filename, without downloading it.",
  schema: {
    peer: z.string().describe("The chat."),
    message_id: z.number().describe("The message."),
  },
  risk: "read",
  profile: "full",
  async handler({ peer, message_id }, ctx) {
    const entity = await ctx.api.entity(peer);
    return ctx.api.run(async (client) => {
      const [msg] = await client.getMessages(entity as never, { ids: [message_id] });
      const m = msg as unknown as Any | undefined;
      const media = m?.media as Any | undefined;
      if (!media) return { media: null };
      const doc = (media.document ?? media.photo) as Any | undefined;
      const attrs = (doc?.attributes as Any[]) ?? [];
      const nameAttr = attrs.find((a) => a.className === "DocumentAttributeFilename");
      return {
        kind: String(media.className ?? "").replace(/^MessageMedia/, "").toLowerCase(),
        mime: doc?.mimeType ? String(doc.mimeType) : undefined,
        size: doc?.size ? Number(doc.size) : undefined,
        filename: nameAttr ? sanitize(String(nameAttr.fileName ?? "")) : undefined,
      };
    });
  },
});

export const PROFILE_TOOLS = [
  updateProfile,
  setProfilePhoto,
  listProfilePhotos,
  deleteProfilePhoto,
  getPrivacy,
  sendVoice,
  mediaInfo,
];
