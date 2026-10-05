#!/usr/bin/env node
/**
 * Both binaries. `telegram-mcp` with no arguments serves MCP over stdio, which
 * is what an MCP client launches; `telegram-mcp --channel` serves the channel
 * instead; and any command runs one tool from the shell.
 *
 * stdout carries the protocol, so nothing else may write to it.
 *
 * Node's compile cache goes on before the app loads, so every launch after the
 * first skips compiling it again. NODE_DISABLE_COMPILE_CACHE=1 turns it off.
 */

import * as nodeModule from "node:module";

nodeModule.enableCompileCache?.();

// 0.4 accepted --cli on either binary; Slipway tells them apart by name.
const argv = process.argv.slice(2).filter((arg) => arg !== "--cli");

if (argv.includes("--channel")) {
  const { channelApp } = await import("./channel.js");
  await channelApp.main(argv.filter((arg) => arg !== "--channel"));
} else {
  if (argv.includes("--http")) {
    // 0.4 took --host; Slipway reads TELEGRAM_HTTP_HOST.
    const at = argv.findIndex((arg) => arg === "--host" || arg.startsWith("--host="));
    if (at !== -1) {
      const value = argv[at]!.includes("=") ? argv[at]!.split("=")[1] : argv[at + 1];
      if (value) process.env.TELEGRAM_HTTP_HOST = value;
      argv.splice(at, argv[at]!.includes("=") ? 1 : 2);
    }
  }
  const { app } = await import("./app.js");
  await app.main(argv);
  // A command is done once main returns, but GramJS keeps its connection open
  // and the process would wait on it forever, so it exits here, as 0.4 did.
  // Serving, over stdio or --http, goes on.
  const asCli = (process.argv[1] ?? "").split(/[\\/]/).pop()?.startsWith("telegram-cli") ?? false;
  const serving = argv.includes("--http") || (!asCli && argv.length === 0);
  if (!serving) process.stdout.write("", () => process.stderr.write("", () => process.exit(process.exitCode ?? 0)));
}
