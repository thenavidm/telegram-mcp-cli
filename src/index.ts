#!/usr/bin/env node
/**
 * Entry point.
 *
 * `telegram-mcp`          Run over stdio. This is what an MCP client launches.
 * `telegram-mcp doctor`   Check the setup and say what is wrong.
 * `telegram-cli`          The same tools as shell commands.
 */

import { runCli, isCliCommand } from "./cli.js";
import { startServer, VERSION } from "./server.js";

const HELP = `telegram-mcp ${VERSION}

  telegram-mcp                Run over stdio. This is what an MCP client launches.
  telegram-mcp --http         Run over HTTP, for a machine that is always on.
  telegram-mcp --channel      Push real Telegram messages into a running Claude session.
  telegram-mcp login          Sign in once and print a session string.
  telegram-mcp doctor         Check the setup and report what is wrong.
  telegram-mcp --version      Print the version.
  telegram-cli                List every command.

Credentials:
  TELEGRAM_API_ID             from https://my.telegram.org, API development tools
  TELEGRAM_API_HASH           issued with the api_id, same page
  TELEGRAM_SESSION            from \`telegram-mcp login\`. Full account access.

Options:
  TELEGRAM_TOOLS              core (default), full, or read. Decides context cost.
  TELEGRAM_READ_ONLY=1        disable every write
  TELEGRAM_ALLOW_DESTRUCTIVE=1  permit the irreversible tools at all
  TELEGRAM_AUDIT_LOG          append-only log of every attempted write
  TELEGRAM_TIMEOUT            per-call deadline in seconds, default 30
  TELEGRAM_HTTP_PORT / _HOST / _TOKEN   for --http. Loopback and a bearer token by default.
  TELEGRAM_SESSION_<LABEL>    a second account, reachable with the account argument
  TELEGRAM_CHANNEL_ALLOW      allowlist path for --channel, default ~/.telegram-mcp/channel-allow.json

https://github.com/thenavidm/telegram-mcp-cli
`;

/**
 * One entry point, two programs. `telegram-mcp` is the server and must stay
 * silent on stdout; `telegram-cli` is the one a person types. Running the CLI
 * binary with no arguments is someone asking what they can type, so it lists
 * the commands rather than hanging on a transport that will never speak.
 */
function invokedAsCli(): boolean {
  const name = (process.argv[1] ?? "").split("/").pop() ?? "";
  return name.startsWith("telegram-cli") || process.argv.includes("--cli");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--cli");
  const command = argv[0];

  if (invokedAsCli() && argv.length === 0) {
    process.exitCode = await runCli(["tools"]);
    return;
  }

  // Checked before --help so `<tool> --help` reaches the tool. A bare --help
  // starts with a dash and falls through to the block below.
  if (isCliCommand(argv)) {
    process.exitCode = await runCli(argv);
    return;
  }

  // An unknown word must not fall through and start the server, or a typo looks
  // like a hang and scripts see exit code 0.
  const ENTRY_COMMANDS = new Set(["login", "doctor", "help"]);

  if (
    invokedAsCli() &&
    command !== undefined &&
    !command.startsWith("-") &&
    !ENTRY_COMMANDS.has(command)
  ) {
    process.stderr.write(
      `${JSON.stringify({ error: `Unknown command '${command}'. Run \`telegram-cli\` to list them.` }, null, 2)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (argv.includes("--help") || argv.includes("-h") || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (command === "login") {
    // Imported here rather than at the top: login pulls in the interactive
    // prompt path, and the server must never pay to load it.
    const { runLogin } = await import("./auth/login.js");
    process.exitCode = await runLogin(argv.slice(1));
    return;
  }

  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    process.exitCode = await runDoctor();
    return;
  }

  if (argv.includes("--channel")) {
    const { startChannel } = await import("./channel.js");
    await startChannel();
    return;
  }

  if (argv.includes("--http")) {
    const { httpOptionsFromEnv, startHttpServer } = await import("./transport/http.js");
    const { buildServer } = await import("./server.js");
    await startHttpServer(buildServer, httpOptionsFromEnv(argv));
    return;
  }

  await startServer();
}

main().catch((error: unknown) => {
  // stdout belongs to the protocol, so failures go to stderr and the exit code
  // carries the meaning for anything scripting this.
  process.stderr.write(`${(error as Error)?.message ?? String(error)}\n`);
  process.exit((error as { exitCode?: number })?.exitCode ?? 1);
});
