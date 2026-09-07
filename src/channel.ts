/**
 * The channel surface: push real Telegram messages into a running session.
 *
 * The official Telegram channel plugin is a BotFather bot, so it only ever
 * receives messages sent to that bot. This one is backed by the same MTProto
 * account as the rest of the server, so an event can come from any chat you
 * are actually in. That is the whole reason it exists.
 *
 * It also makes the allowlist load-bearing rather than a formality. Without
 * one, every message in every group becomes model input: a token problem and a
 * prompt-injection surface at the same time. Nothing is forwarded unless a chat
 * is explicitly allowed.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TelegramApi } from "./api/client.js";
import { loadConfig } from "./config.js";
import { VERSION } from "./server.js";
import { displayName, sanitize, truncate } from "./format/render.js";

type Any = Record<string, unknown>;

const ALLOW_PATH =
  process.env.TELEGRAM_CHANNEL_ALLOW ?? join(homedir(), ".telegram-mcp", "channel-allow.json");

type Allow = {
  /** Chat ids that may push events in. */
  chats: string[];
  /** Optional label per chat, so a persona can be routed by name. */
  personas: Record<string, string>;
};

function readAllow(): Allow {
  try {
    const raw = JSON.parse(readFileSync(ALLOW_PATH, "utf-8")) as Partial<Allow>;
    return { chats: raw.chats ?? [], personas: raw.personas ?? {} };
  } catch {
    return { chats: [], personas: {} };
  }
}

function writeAllow(allow: Allow): void {
  mkdirSync(dirname(ALLOW_PATH), { recursive: true });
  writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + "\n", { mode: 0o600 });
}

/**
 * Meta keys become attributes on the `<channel>` tag, and the runtime silently
 * drops any key that is not an identifier. Hyphens are the easy mistake, so
 * everything is normalised rather than trusted.
 */
function metaKey(key: string): string {
  return key.replace(/[^A-Za-z0-9_]/g, "_");
}

export async function startChannel(): Promise<void> {
  const config = loadConfig();
  const api = new TelegramApi(config);

  const server = new Server(
    { name: "telegram-channel", version: VERSION },
    // `claude/channel` is an Anthropic extension the SDK's typed capability map
    // does not know about, so the cast lives here rather than being worked
    // around by dropping the declaration the runtime requires.
    { capabilities: { tools: {}, "claude/channel": {} } as never },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "reply",
        description:
          "Reply into the Telegram chat an event came from. Pass the chat_id from the channel event.",
        inputSchema: {
          type: "object",
          properties: {
            chat_id: { type: "string", description: "chat_id from the channel event." },
            text: { type: "string", description: "What to send." },
            reply_to: { type: "number", description: "Message id to quote, optional." },
          },
          required: ["chat_id", "text"],
        },
      },
      {
        name: "allow_chat",
        description:
          "Let a chat push events into this session, optionally under a persona name. Nothing is forwarded until a chat is allowed.",
        inputSchema: {
          type: "object",
          properties: {
            peer: { type: "string", description: "A @username, id, or 'me'." },
            persona: {
              type: "string",
              description: "Name for this chat's persona, e.g. health-coach. Optional.",
            },
          },
          required: ["peer"],
        },
      },
      {
        name: "list_allowed",
        description: "Which chats may push events, and the persona each maps to.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Any;
    const ok = (data: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    });

    try {
      if (req.params.name === "reply") {
        const entity = await api.entity(String(args.chat_id));
        await api.run(async (client) => {
          await client.sendMessage(entity as never, {
            message: String(args.text),
            ...(args.reply_to ? { replyTo: Number(args.reply_to) } : {}),
          });
        });
        return ok({ sent: true });
      }

      if (req.params.name === "allow_chat") {
        const entity = (await api.entity(String(args.peer))) as unknown as Any;
        const id = String((entity.id as { value?: unknown })?.value ?? entity.id ?? "");
        const allow = readAllow();
        if (!allow.chats.includes(id)) allow.chats.push(id);
        if (args.persona) allow.personas[id] = String(args.persona);
        writeAllow(allow);
        return ok({ allowed: id, name: displayName(entity), persona: args.persona ?? null });
      }

      if (req.params.name === "list_allowed") {
        const allow = readAllow();
        return ok({
          count: allow.chats.length,
          chats: allow.chats.map((id) => ({ id, persona: allow.personas[id] ?? null })),
        });
      }

      return { content: [{ type: "text" as const, text: `Unknown tool ${req.params.name}` }], isError: true };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  });

  await server.connect(new StdioServerTransport());

  // Subscribing after connect, so a failure to reach Telegram does not stop the
  // channel registering. A session that turns out to be bad is reported on
  // stderr and the MCP surface stays up, because a channel that exits on a bad
  // credential takes the whole session's channel support down with it.
  let client;
  try {
    client = await api.connect();
  } catch (error) {
    process.stderr.write(
      `telegram channel: cannot reach Telegram, ${(error as Error).message}. ` +
        `The reply and allowlist tools still work once the session is fixed.\n`,
    );
    return;
  }
  const { NewMessage } = await import("telegram/events/index.js");

  client.addEventHandler(async (event: Any) => {
    try {
      const message = event.message as Any | undefined;
      if (!message) return;

      const chatId = String(
        (await (async () => {
          const chat = (await (event.getChat as () => Promise<Any>)()) as Any;
          return (chat?.id as { value?: unknown })?.value ?? chat?.id ?? "";
        })()),
      );

      const allow = readAllow();
      // Silently dropped rather than refused: an un-allowed chat is not an
      // error, it is the default, and every group you are in would qualify.
      if (!allow.chats.includes(chatId)) return;

      const sender = (await (event.getSender as () => Promise<Any>)()) as Any;
      const text = sanitize(String(message.message ?? ""));
      if (!text) return;

      const meta: Record<string, string> = {
        [metaKey("chat_id")]: chatId,
        [metaKey("message_id")]: String(message.id ?? ""),
        [metaKey("sender")]: displayName(sender) || "unknown",
      };
      const persona = allow.personas[chatId];
      if (persona) meta[metaKey("persona")] = persona;

      await server.notification({
        method: "notifications/claude/channel",
        params: { content: truncate(text, 2000), meta },
      });
    } catch {
      // A malformed update must never take the listener down, or one bad
      // message ends the channel for the whole session.
    }
  }, new NewMessage({}));

  process.stderr.write(
    `telegram channel listening. ${readAllow().chats.length} chat(s) allowed. ` +
      `Allowlist: ${ALLOW_PATH}\n`,
  );
}
