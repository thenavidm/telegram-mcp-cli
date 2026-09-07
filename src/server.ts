/**
 * The MCP surface.
 *
 * Reads ALL_TOOLS through the active profile, so what gets advertised is a
 * configuration decision rather than a code one.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TelegramApi } from "./api/client.js";
import { loadConfig } from "./config.js";
import { WriteGuard } from "./safety.js";
import { makeContext, register } from "./tools/kit.js";
import { activeProfile, toolsFor } from "./tools/index.js";

export const VERSION = "0.3.0";

export function buildServer(): McpServer {
  const config = loadConfig();
  const api = new TelegramApi(config);
  const guard = new WriteGuard(config, "mcp");
  const ctx = makeContext(api, config, guard);

  const server = new McpServer({
    name: "telegram",
    version: VERSION,
  });

  for (const spec of toolsFor(activeProfile())) {
    register(server, ctx, spec);
  }

  return server;
}

export async function startServer(): Promise<void> {
  // stdio carries the JSON-RPC stream, so nothing else may write to stdout.
  // Anything this process wants to say goes to stderr.
  const transport = new StdioServerTransport();
  await buildServer().connect(transport);
}
