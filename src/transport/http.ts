/**
 * HTTP transport, for running this somewhere always on.
 *
 * stdio is right for a client that launches the server itself. It is wrong for
 * a long-lived process that several things connect to, which is what the
 * persona setup needs: one signed-in server, many sessions reaching it.
 *
 * Because this listens on a port, it binds to loopback and requires a bearer
 * token by default. A Telegram session string is full account access, and a
 * server holding one must not be reachable by anything that happens to be on
 * the network.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type HttpOptions = {
  port: number;
  host: string;
  /** Required in the Authorization header, unless explicitly disabled. */
  token: string | undefined;
};

export function httpOptionsFromEnv(argv: string[] = []): HttpOptions {
  const flag = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const port = Number(flag("port") ?? process.env.TELEGRAM_HTTP_PORT ?? 8787);
  return {
    port: Number.isFinite(port) ? port : 8787,
    host: flag("host") ?? process.env.TELEGRAM_HTTP_HOST ?? "127.0.0.1",
    token: process.env.TELEGRAM_HTTP_TOKEN || undefined,
  };
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized. Set TELEGRAM_HTTP_TOKEN and send it as a bearer token." }));
}

/**
 * Serve MCP over streamable HTTP.
 *
 * A server instance is built per session, not shared. The SDK's Protocol
 * refuses to connect one instance to a second transport, so reusing it crashed
 * the process the moment a client opened a second session, which a single
 * hand-run curl never does but a real client does immediately.
 */
export async function startHttpServer(
  makeServer: () => McpServer,
  options: HttpOptions,
): Promise<void> {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Binding to loopback is the real protection; the token is what makes it
    // safe to move that binding deliberately.
    if (options.token) {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${options.token}`) return unauthorized(res);
    }

    if (req.url?.startsWith("/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, sessions: sessions.size }));
      return;
    }

    const id = (req.headers["mcp-session-id"] as string | undefined) ?? undefined;

    // A GET with no session is a client probing the endpoint, not resuming a
    // stream. Handing it to the SDK makes a fresh transport that answers
    // "Server not initialized" with a 400, and clients read that as "this is
    // not an MCP server". Refusing with 405 is what the working hosted
    // connectors do, and it is what a stateless endpoint should say.
    if (req.method === "GET" && !id) {
      res.writeHead(405, { "content-type": "application/json", allow: "POST, DELETE, OPTIONS" });
      res.end(JSON.stringify({ error: "Method Not Allowed. Open a session with POST initialize." }));
      return;
    }

    let transport = id ? sessions.get(id) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          sessions.set(sid, transport as StreamableHTTPServerTransport);
        },
      });
      transport.onclose = () => {
        const sid = transport?.sessionId;
        if (sid) sessions.delete(sid);
      };
      await makeServer().connect(transport);
    }

    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    http.listen(options.port, options.host, resolve);
  });

  // stdout is reserved for the protocol on the stdio path, so even here the
  // human-facing line goes to stderr and stays consistent.
  process.stderr.write(
    `telegram-mcp listening on http://${options.host}:${options.port}` +
      (options.token ? " (bearer token required)\n" : " (no token set, loopback only)\n"),
  );
}
