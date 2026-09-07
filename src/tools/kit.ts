/**
 * Shared plumbing every tool uses.
 *
 * One array of specs feeds three consumers: the MCP server, the CLI, and the
 * channel. Describing a tool once is what keeps them from drifting, so this
 * wraps registration, guarding and error shaping in a single place and leaves
 * a tool module to describe only what it actually does.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import type { TelegramApi } from "../api/client.js";
import { TelegramError } from "../api/errors.js";
import type { Config } from "../config.js";
import { annotationsFor, type Risk, type WriteGuard } from "../safety.js";

export type ToolContext = {
  api: TelegramApi;
  config: Config;
  guard: WriteGuard;
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Which profile a tool belongs to.
 *
 * Tool definitions are sent on every turn, so they are rent rather than a
 * one-off cost. `core` is the ~14 tools that carry daily use; everything else
 * is `full` and reachable from the CLI at no context cost at all.
 */
export type Profile = "core" | "full";

export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * Errors come back as a readable result, not a thrown protocol failure.
 *
 * A thrown MCP error reaches the model as an opaque transport problem. A result
 * carrying the code, the message and often a hint is the difference between the
 * model retrying correctly and giving up. Flood waits especially: the model can
 * only wait the right number of seconds if we tell it the number.
 */
export function fail(error: unknown): ToolResult {
  const payload =
    error instanceof TelegramError
      ? error.toJSON()
      : { error: (error as Error)?.message ?? String(error) };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

/** The confirmation argument every irreversible tool carries. */
export const confirmArg = {
  confirm: z
    .boolean()
    .optional()
    .describe("Must be true for this to run. This cannot be undone, so it is refused without it."),
};

/** Field projection, on every tool that returns a list. */
/** The optional argument that picks an account, on every account-scoped tool. */
export const accountArg = {
  account: z
    .string()
    .optional()
    .describe(
      "Which configured account to act as, matched loosely against its label. Defaults to the first.",
    ),
};

export const selectArg = {
  fields: z
    .string()
    .optional()
    .describe("Comma separated fields to keep, e.g. 'id,text'. Dotted paths descend. Cuts response size."),
};

export type ToolSpec<S extends ZodRawShape> = {
  name: string;
  /** One line, imperative. Shown in tool pickers. */
  title: string;
  description: string;
  schema: S;
  risk: Risk;
  profile: Profile;
  /** True when the effect is visible to anyone but you. */
  public?: boolean;
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
  /** One line for the audit log, when this is a write. */
  summary?: (args: z.infer<z.ZodObject<S>>) => string;
};

export function defineTool<S extends ZodRawShape>(spec: ToolSpec<S>): ToolSpec<S> {
  return spec;
}

/**
 * A tool of any shape, for the one place tools are collected into a list.
 *
 * `ToolSpec` is generic over its schema, so a list of tools with different
 * schemas has no single type: handlers accept different argument shapes and
 * function parameters are contravariant. The safety that matters lives inside
 * each `defineTool` call, where schema and handler are checked against each
 * other. Only the collection seam is loosened.
 *
 * The handler parameter is erased to `never` rather than widened to `any`:
 * `never` is assignable to every argument type, so any concrete handler fits,
 * whereas a widened object type fails contravariance and rejects all of them.
 */
export type AnyToolSpec = Omit<ToolSpec<ZodRawShape>, "handler" | "summary"> & {
  handler: (args: never, ctx: ToolContext) => Promise<unknown>;
  summary?: (args: never) => string;
};

/** Register one tool, with guarding and error handling applied. */
export function register(server: McpServer, ctx: ToolContext, spec: AnyToolSpec): void {
  // A read-only server should not advertise writes it will refuse.
  if (ctx.guard.readOnly && spec.risk !== "read") return;

  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.schema,
      annotations: { title: spec.title, ...annotationsFor(spec.risk) },
    },
    // The SDK derives its callback type from the schema generic. This wrapper is
    // generic over the same shape, but TypeScript cannot prove the two equal
    // through the indirection, so the cast lives at this one boundary rather
    // than in every tool definition.
    (async (args: Record<string, unknown>) => {
      try {
        if (spec.risk !== "read") {
          const summary = spec.summary?.(args as never) ?? spec.name;
          const confirm = (args as { confirm?: boolean }).confirm;
          ctx.guard.check(spec.name, spec.risk, confirm, summary);
        }
        return ok(await spec.handler(args as never, ctx));
      } catch (error) {
        return fail(error);
      }
    }) as never,
  );
}

export function makeContext(api: TelegramApi, config: Config, guard: WriteGuard): ToolContext {
  return { api, config, guard };
}

/** Clamp a caller-supplied limit into a range Telegram will accept. */
export function clamp(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
