/**
 * Shared plumbing every tool uses, now on Slipway.
 *
 * Tool modules keep describing themselves with a Zod shape, a risk and a
 * handler. This adapter turns each into a Slipway tool, so the MCP server, the
 * CLI, the write guard, annotations and errors all come from the framework
 * instead of a copy kept in this repo.
 */

import { ApiError, AuthError, NotConfiguredError, NotFoundError, RateLimitError, RefusedError, SlipwayError, toolkit, z, type Risk, type Tool } from "@thenavidm/slipway";
import type { TelegramApi } from "../api/client.js";
import type { Config } from "../config.js";
import { TelegramError } from "../api/errors.js";
import { ConfigError } from "../config.js";

export type ToolContext = {
  api: TelegramApi;
  config: Config;
};

const kit = toolkit<ToolContext>();

/**
 * Which profile a tool belongs to.
 *
 * Tool definitions are sent on every turn, so they are rent rather than a
 * one-off cost. `core` is the ~14 tools that carry daily use; everything else
 * is `full` and reachable from the CLI at no context cost at all.
 */
export type Profile = "core" | "full";

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

export type ToolSpec<S extends Shape> = {
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

/**
 * A tool of any shape, for the one place tools are collected into a list.
 *
 * `ToolSpec` is generic over its schema, so a list of tools with different
 * schemas has no single type. The handler parameter is erased to `never`,
 * which every concrete handler is assignable to.
 */
export type AnyToolSpec = Omit<ToolSpec<Shape>, "handler" | "summary"> & {
  handler: (args: never, ctx: ToolContext) => Promise<unknown>;
  summary?: (args: never) => string;
};

export function makeContext(api: TelegramApi, config: Config): ToolContext {
  return { api, config };
}

/** Clamp a caller-supplied limit into a range Telegram will accept. */
export function clamp(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

/**
 * Kept so tool modules read the same, but never sent: Slipway adds `confirm`
 * to every irreversible tool itself, with one description everywhere.
 */
export const confirmArg = {
  confirm: z.boolean().optional(),
};

type Shape = Record<string, z.ZodType>;

/**
 * A failure as the Slipway error that carries its exit code, which is the
 * code 0.4 gave it: Telegram's own kind of failure decides, a flood wait
 * carries its seconds, and a missing credential is setup, 10.
 */
export function toSlipway(error: unknown): unknown {
  if (error instanceof SlipwayError) return error;
  if (error instanceof ConfigError) return new NotConfiguredError(error.message);
  if (!(error instanceof TelegramError)) return error;
  const options = { ...(error.hint ? { hint: error.hint } : {}), details: { telegram_code: error.code } };
  switch (error.code) {
    case "NOT_CONFIGURED":
      return new NotConfiguredError(error.message, options);
    case "AUTH":
      return new AuthError(error.message, options);
    case "NOT_FOUND":
      return new NotFoundError(error.message, options);
    case "RATE_LIMIT":
      return new RateLimitError(error.message, { ...options, ...(error.retryAfter !== undefined ? { retryAfterSeconds: error.retryAfter } : {}) });
    case "REFUSED":
      return new RefusedError(error.message, options);
    default:
      // FORBIDDEN and the rest: Telegram answered and said no, which 0.4 gave 5.
      return new ApiError(error.message, options);
  }
}

/** Specs keep their 0.4 shape, so tool modules read the same; `slipwayTool` turns one into what Slipway serves. */
export function defineTool<S extends Shape>(spec: ToolSpec<S>): ToolSpec<S> {
  return spec;
}

/**
 * One spec as a Slipway tool, in the toolset of its module and, for the daily
 * ones, in `core`, which is what TELEGRAM_TOOLS=core showed.
 */
export function slipwayTool(spec: AnyToolSpec, toolset: string): Tool<ToolContext> {
  const { confirm: _confirm, ...shape } = spec.schema;
  const handler = spec.handler as unknown as (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  return kit.defineTool({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    input: z.object(shape),
    risk: spec.risk,
    ...(spec.risk === "destructive" ? { consequence: "is irreversible" } : {}),
    ...(spec.summary ? { summary: spec.summary as (args: Record<string, unknown>) => string } : {}),
    tags: spec.profile === "core" ? ["core", toolset] : [toolset],
    handler: async (args, ctx) => {
      try {
        return await handler(args, ctx);
      } catch (error) {
        throw toSlipway(error);
      }
    },
  });
}
