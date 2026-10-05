# telegram-mcp-cli

MCP server and CLI for a real Telegram account over MTProto. One of a family of
`*-mcp-cli` repos that are deliberately identical in structure. Match the family
before matching your own instincts.

## The seam

`src/tools/index.ts` exports `TOOLS`, built on Slipway from the specs each
module describes once, in one `defineTool` call, and `src/app.ts` serves them
as the MCP server and the CLI. Each module is a toolset, and the daily tools
are also in `core`. The channel is its own small Slipway app in `channel.ts`.

Never add a tool to one surface only. If it needs describing twice, the change
is in the wrong place.

## Token cost is a design constraint, not an afterthought

Every tool definition is sent to the model on every turn. Measured on this
build: 13 tools is 2,218 tokens, 7 is 1,241, counted with a tokeniser.

- New tools default to `profile: "full"`, not `"core"`. `core` has to be earned.
- Never return a raw MTProto entity. Project in `format/render.ts`.
- Default limits stay low. 20, not 100, and clamp rather than trust.
- Re-measure and update the README after adding tools. The numbers in the README
  are load-bearing and must come from a real handshake.

## Safety

Slipway's guard, from each tool's risk. `read` passes through, `write` is
recorded, `destructive` needs confirming and is off entirely unless
`TELEGRAM_ALLOW_DESTRUCTIVE=1`, through `defaults.allowDestructive`.

Risk levels are `read` | `write` | `destructive`. Not "irreversible", even
though that is the word the docs use, because Slipway reads `destructive`.

## stdout belongs to the protocol

The MCP transport is JSON-RPC on stdout. Anything else written there corrupts
the stream. GramJS logs to stdout by default, which is why `client.setLogLevel`
is called before connecting. Human-facing output goes to stderr, and `login`
prints only the session string on stdout so it can be redirected to a file.

## The session string

Full account access, non-expiring. Never write it to disk, never log it, never
put it in an error message. It is read from the environment and nowhere else.

## Before saying a change is done

- `npm run typecheck && npm run build && npm test`
- a real `tools/list` handshake, not just unit tests
- the binary run bare, one `--help`, one real read
- unconfigured exits 10, a missing required argument exits 2
- every count in the README read off the running binary, not typed
- `desktop-extension/manifest.json` version matches `package.json`
- open the rendered README and read the first screenful

## Never

Never hand-edit generated output. Never commit a credential. Never run
`git checkout`, `reset` or `restore`. Delete means move to `_archive/`, and only
"permanently delete" removes anything.
