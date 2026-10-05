/**
 * The server, the channel and the CLI, now built by Slipway from the same tools.
 *
 * Parsing, help and output shapes are Slipway's and tested there. These cover
 * what this repo promises: every tool is a command, the daily tools are what an
 * MCP client loads by default and 0.4's TELEGRAM_TOOLS still picks the rest while
 * the terminal runs every command, irreversible tools stay
 * off until TELEGRAM_ALLOW_DESTRUCTIVE=1, Telegram's failures keep their exit
 * codes, the channel declares itself where Claude Code looks and forwards only
 * allowed chats, and the docs stay in step with the code.
 *
 * No credential is in reach: the environment's are removed before anything
 * loads, every call passes its own empty environment, and the channel's client
 * is a stand-in. Nothing here can sign in to Telegram.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

for (const name of Object.keys(process.env)) if (/^TELEGRAM_(SESSION|API_ID|API_HASH)/.test(name)) delete process.env[name];
const allowFile = join(mkdtempSync(join(tmpdir(), "telegram-channel-")), "allow.json");
process.env.TELEGRAM_CHANNEL_ALLOW = allowFile;

const { checkApp, cli, connect } = await import("@thenavidm/slipway/testing");
const { app } = await import("../src/app.js");
const { channelApp, listen } = await import("../src/channel.js");
const { TOOLS } = await import("../src/tools/index.js");
const { toSlipway } = await import("../src/tools/kit.js");
const { TelegramError } = await import("../src/api/errors.js");
const { ConfigError } = await import("../src/config.js");

const listed = async (env: NodeJS.ProcessEnv): Promise<string[]> => {
  const mcp = await connect(app, { env });
  const names = (await mcp.listTools()).map((tool) => tool.name);
  await mcp.close();
  return names;
};
const commands = async (env: NodeJS.ProcessEnv) =>
  (JSON.parse((await cli(app, ["agent-context", "--brief"], { env })).stdout).commands as Array<{ command: string; requires_confirm?: boolean }>);

describe("Telegram on Slipway", () => {
  it("makes all 74 tools commands, the irreversible ones needing confirmation", async () => {
    const all = await commands({ TELEGRAM_TOOLS: "full", TELEGRAM_ALLOW_DESTRUCTIVE: "1" });
    expect(all.map((c) => c.command).sort()).toEqual(TOOLS.map((tool) => tool.command).sort());
    expect(all).toHaveLength(74);
    expect(all.filter((c) => c.requires_confirm).map((c) => c.command).sort()).toEqual(
      ["delete", "delete-contact", "delete-folder", "delete-history", "delete-profile-photo", "delete-scheduled", "leave-chat", "set-banned"].sort(),
    );
  });

  it("lists the 13 daily tools to an MCP client by default, every tool with TELEGRAM_TOOLS=full, every read with read", async () => {
    expect(await listed({})).toHaveLength(13);
    expect(await listed({ TELEGRAM_TOOLS: "full" })).toHaveLength(74);
    const reads = await listed({ TELEGRAM_TOOLS: "read" });
    expect(reads).toHaveLength(31);
    expect(reads).not.toContain("send");
    // A module by name, as a toolset.
    expect(await listed({ TELEGRAM_TOOLSETS: "topics" })).toContain("create_topic");
  });

  it("runs every command in the terminal whatever TELEGRAM_TOOLS says, as 0.4 did", async () => {
    expect(await commands({})).toHaveLength(74);
    expect(await commands({ TELEGRAM_TOOLS: "read" })).toHaveLength(74);
    expect((await cli(app, ["create-topic", "--help"], { env: {} })).code).toBe(0);
    expect((await cli(app, ["which", "create", "a", "forum", "topic"], { env: {} })).stdout).toContain("create-topic");
    // A send gets as far as asking for credentials, and none are set here.
    expect((await cli(app, ["send", "--peer", "me", "--text", "hi", "--agent"], { env: { TELEGRAM_TOOLS: "read" } })).code).toBe(10);
  });

  it("keeps irreversible tools off until TELEGRAM_ALLOW_DESTRUCTIVE=1, and then asks first", async () => {
    const off = await cli(app, ["delete", "--peer", "me", "--message-ids", "1", "--confirm", "--agent"], { env: {} });
    expect(off.code).toBe(2);
    expect(JSON.parse(off.stderr)).toMatchObject({
      error: "delete is unavailable: irreversible writes are off until TELEGRAM_ALLOW_DESTRUCTIVE=1 is set.",
      hint: "Set TELEGRAM_ALLOW_DESTRUCTIVE=1 to allow irreversible writes.",
    });
    const on = { TELEGRAM_ALLOW_DESTRUCTIVE: "1" };
    const unconfirmed = await cli(app, ["delete", "--peer", "me", "--message-ids", "1", "--agent"], { env: on });
    expect(unconfirmed.code).toBe(2);
    expect(JSON.parse(unconfirmed.stderr).error).toMatch(/^delete is irreversible, so it will not run without --confirm\. About to: delete 1 message\(s\) in me\./);
    // Confirmed, it gets as far as asking for credentials, and none are set here.
    expect((await cli(app, ["delete", "--peer", "me", "--message-ids", "1", "--confirm", "--agent"], { env: on })).code).toBe(10);
  });

  it("reads a list of message ids as numbers, as 0.4 did", async () => {
    const run = await cli(app, ["delete", "--peer", "me", "--message-ids", "1", "--message-ids", "2", "--dry-run", "--agent"], { env: { TELEGRAM_ALLOW_DESTRUCTIVE: "1" } });
    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ would_run: { message_ids: [1, 2] } });
  });

  it("says exactly which credential is missing, with exit 10", async () => {
    const run = await cli(app, ["history", "--peer", "me", "--agent"], { env: {} });
    expect(run.code).toBe(10);
    expect(JSON.parse(run.stderr).error).toMatch(/^Missing TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION\./);
  });

  it("calls a session GramJS cannot read a setup problem, before any connection", async () => {
    const env = { TELEGRAM_API_ID: "1", TELEGRAM_API_HASH: "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", TELEGRAM_SESSION: "not-a-session" };
    const run = await cli(app, ["history", "--peer", "me", "--agent"], { env });
    expect(run.code).toBe(10);
    expect(JSON.parse(run.stderr).error).toMatch(/^TELEGRAM_SESSION is not a session string telegram-cli login printed\./);
  });

  it("gives Telegram's failures the exit codes 0.4 gave them", () => {
    const code = (error: unknown) => (toSlipway(error) as { exitCode: number }).exitCode;
    expect(code(new TelegramError("RATE_LIMIT", "slow down", { retryAfter: 42 }))).toBe(7);
    expect((toSlipway(new TelegramError("RATE_LIMIT", "slow down", { retryAfter: 42 })) as { retryAfterSeconds?: number }).retryAfterSeconds).toBe(42);
    expect(code(new TelegramError("AUTH", "session revoked"))).toBe(4);
    expect(code(new TelegramError("NOT_FOUND", "no such chat"))).toBe(3);
    expect(code(new TelegramError("REFUSED", "not allowed here"))).toBe(2);
    expect(code(new TelegramError("FORBIDDEN", "admin required"))).toBe(5);
    expect(code(new TelegramError("API", "internal"))).toBe(5);
    expect(code(new ConfigError("Missing TELEGRAM_SESSION."))).toBe(10);
  });

  it("passes slipway check", async () => {
    for (const each of [app, channelApp]) {
      const report = await checkApp(each, { env: { TELEGRAM_TOOLS: "full" } });
      expect(report.findings.filter((finding: { level: string }) => finding.level === "error")).toEqual([]);
    }
  });
});

describe("the channel", () => {
  it("declares claude/channel under the experimental capabilities, with its three tools", async () => {
    const mcp = await connect(channelApp, { env: {} });
    const names = (await mcp.listTools()).map((tool) => tool.name);
    await mcp.close();
    expect(mcp.initialize.capabilities).toMatchObject({ experimental: { "claude/channel": {} } });
    expect(mcp.initialize.instructions).toMatch(/reply tool, passing the chat_id/);
    expect(names).toEqual(["reply", "allow_chat", "list_allowed"]);
  });

  it("forwards a message from an allowed chat, and drops one from any other", async () => {
    writeFileSync(allowFile, JSON.stringify({ chats: ["100"], personas: { "100": "coach" } }));
    let handler: ((event: unknown) => Promise<void>) | undefined;
    const api = { connect: async () => ({ addEventHandler: (fn: (event: unknown) => Promise<void>) => (handler = fn) }) };
    const sent: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const log = { info: () => undefined, warn: () => undefined };
    await listen({ api } as never, log, async (method, params) => (sent.push({ method, params }), true));
    const event = (chat: number, text: string) => ({
      message: { id: 7, message: text },
      getChat: async () => ({ id: chat }),
      getSender: async () => ({ firstName: "Ana" }),
    });
    await handler!(event(100, "hello"));
    await handler!(event(200, "not for you"));
    expect(sent).toEqual([
      { method: "notifications/claude/channel", params: { content: "hello", meta: { chat_id: "100", message_id: "7", sender: "Ana", persona: "coach" } } },
    ]);
  });
});

describe("documentation stays in step with the code", () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf-8");
  const names = (text: string): Set<string> => new Set((text.match(/\bTELEGRAM_[A-Z_]+/g) ?? []).filter((name) => !name.endsWith("_")));
  const source = (dir: string): string =>
    readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
      .map((entry) => (entry.isDirectory() ? source(`${dir}${entry.name}/`) : entry.name.endsWith(".ts") ? read(`${dir}${entry.name}`) : ""))
      .join("\n");

  it("documents every environment variable the code reads", async () => {
    const context = JSON.parse((await cli(app, ["agent-context"], { env: {} })).stdout);
    const fromCode = [...source("../src/").matchAll(/env\.(TELEGRAM_[A-Z0-9_]+)/g)].map((m) => m[1] as string);
    const used = new Set([...fromCode, ...context.settings.map((setting: { env: string }) => setting.env)]);
    const documented = names(read("../README.md"));
    expect([...used].filter((v) => !documented.has(v))).toEqual([]);
  });

  it.each(["../README.md"])("has no dead in-page anchors in %s", (file) => {
    if (!existsSync(new URL(file, import.meta.url))) return;
    const md = read(file).replace(/```[\s\S]*?```/g, "");
    // GitHub's slug keeps letters, marks, numbers and connector punctuation, so an
    // emoji's variation selector (U+FE0F) stays in the anchor and a link has to carry it.
    const slugs = new Set(
      [...md.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
        (heading as string).trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "").replace(/ /g, "-"),
      ),
    );
    const dead = [...md.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1] as string)).filter((a) => !slugs.has(a));
    expect(dead).toEqual([]);
  });
});
