/**
 * The Telegram app: everything Slipway needs to ship the MCP server and the CLI.
 *
 * It acts as your own account over MTProto, not as a bot. The daily tools are
 * on by default and the rest are a setting away; irreversible tools stay off
 * until TELEGRAM_ALLOW_DESTRUCTIVE=1, as in 0.4. This file only describes;
 * `index.ts` runs. The channel is its own server, in `channel.ts`.
 */

import { slipway, type DoctorCheck } from "@thenavidm/slipway";
import { TelegramApi } from "./api/client.js";
import { loadConfig } from "./config.js";
import { TOOLS, TOOLSETS } from "./tools/index.js";
import type { ToolContext } from "./tools/kit.js";
import { VERSION } from "./version.js";

/** Where each credential comes from, for doctor. */
const WHERE: Record<string, string> = {
  TELEGRAM_API_ID: "Get one at https://my.telegram.org, API development tools.",
  TELEGRAM_API_HASH: "It comes with the api_id, on the same page.",
  TELEGRAM_SESSION: "Run: telegram-cli login",
};

/**
 * 0.4's doctor: each missing credential with where it comes from, or, with
 * all three set, whether Telegram answers and who it signs in as. A deadline
 * turns GramJS's endless retries into a line of output.
 */
async function doctor({ config, api }: ToolContext): Promise<DoctorCheck[]> {
  if (config.missing.length) return config.missing.map((name) => ({ name, ok: false, detail: "missing", fix: WHERE[name] ?? "" }));
  const seconds = config.timeout + 5;
  try {
    const me = await Promise.race([
      api.run(async (client) => client.getMe()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer from Telegram in ${seconds}s`)), seconds * 1000).unref()),
    ]);
    const who = me as unknown as { username?: string; firstName?: string };
    return [{ name: "Connection", ok: true, detail: `signed in as ${who.username ? `@${who.username}` : (who.firstName ?? "unknown")}` }];
  } catch (error) {
    return [{ name: "Connection", ok: false, detail: (error as Error).message }];
  } finally {
    await api.disconnect();
  }
}

/** 0.4's TELEGRAM_TOOLS: `core` by default, `full` for every tool, `read` for every read and no writes. */
const profile = (env: NodeJS.ProcessEnv): string => (env.TELEGRAM_TOOLS ?? "core").trim().toLowerCase();

export function createApp() {
  return slipway<ToolContext>({
    name: "telegram",
    title: "Telegram",
    version: VERSION,
    package: "@thenavidm/telegram-mcp-cli",
    envPrefix: "TELEGRAM",
    description: "Your own Telegram account over MTProto, as you rather than a bot: chats, history, search, sending, files, contacts, groups and folders.",
    // One context per environment, so every HTTP session shares one MTProto
    // connection: a second connection with the same auth key makes Telegram
    // answer AUTH_KEY_DUPLICATED and cancel the session.
    context: (env) => {
      const config = loadConfig(env);
      return { config, api: new TelegramApi(config) };
    },
    configured: ({ config }) => config.missing.length === 0,
    secrets: ({ config }) => [config.session, config.apiHash, ...config.accounts.map((account) => account.session)],
    tools: TOOLS,
    toolsets: TOOLSETS,
    // As in 0.4, TELEGRAM_TOOLS only decides what an MCP client loads; the terminal runs every command.
    defaults: {
      toolsets: (env, on) => (on === "cli" || profile(env) === "full" || profile(env) === "read" ? "all" : ["core"]),
      readOnly: (env, on) => on === "mcp" && profile(env) === "read",
      // Irreversible tools stay off until TELEGRAM_ALLOW_DESTRUCTIVE=1, as in 0.4.
      allowDestructive: false,
    },
    doctor,
    doctorNetwork: true,
    login: {
      usage: "login",
      help: "sign in and print a session string",
      // Imported here, so the server never loads the interactive prompt path.
      run: async (_io, args) => (await import("./auth/login.js")).runLogin(args),
    },
    settings: [
      { env: "TELEGRAM_API_ID", description: "Your app's api_id, from https://my.telegram.org, API development tools." },
      { env: "TELEGRAM_API_HASH", description: "That app's api_hash.", secret: true },
      { env: "TELEGRAM_SESSION", description: "The session string telegram-cli login prints; full access to the account.", secret: true },
      { env: "TELEGRAM_TOOLS", description: "core (the default), full for every tool, or read for every read and no writes." },
      { env: "TELEGRAM_TIMEOUT", description: "Seconds before an MTProto call gives up; 30 when unset.", tuning: true },
      { env: "TELEGRAM_CHANNEL_ALLOW", description: "The channel's allowlist; ~/.telegram-mcp/channel-allow.json when unset.", tuning: true },
    ],
    links: { repository: "https://github.com/thenavidm/telegram-mcp-cli" },
  });
}

export const app = createApp();
