# Changelog

## 0.5.0, 2026-10-05

Built on [Slipway](https://github.com/thenavidm/slipway) 0.1.24. The 74 tools keep their names and arguments, `TELEGRAM_TOOLS` still decides what an MCP client loads, and the terminal still runs every command. Every difference below was measured against 0.4.4 with no credential anywhere: both versions got a placeholder session that GramJS rejects before it connects, so no measurement reached Telegram.

- **An unconfigured server starts.** 0.4.4 exited when a credential was missing, so a client showed a failed server, and `telegram-cli` could not list its commands or show `--help` until all three were set. Now the server answers and lists its tools, the CLI works, and the first call that needs Telegram names what is missing, exit 10. A session string GramJS cannot read is a setup problem too: exit 10 and "Run: telegram-cli login", where 0.4.4 printed "Not a valid string" and exited 5.
- **`which <words>` finds a command** among the 74, and `agent-context` describes every command, flag and setting as JSON. In Codex 0.159.3, finding the command that searches message text across every chat, and its flags, took a median of 53,221 input tokens over the CLI instead of 72,800 (five runs each): every 0.4.4 run read the general help, the command list and the command's help, and four of five 0.5.0 runs read the general help and asked `which`, two commands.
- **A smaller tool list.** Each tool no longer repeats `$schema`, `additionalProperties: false` or an `execution` block, so the default 13 are 2,254 o200k tokens instead of 2,682, and Claude Code 2.1.286 spends 2,380 tokens a message on them with every tool loaded instead of 2,820. With `TELEGRAM_TOOLS=full`, all 74 are 11,754 o200k tokens instead of 14,184, and 11,868 tokens a message in Claude Code instead of 14,438.
- **A person approves each irreversible call.** `delete` and the seven other irreversible tools ask first over MCP: Claude Code (2.1.246 and later) shows its own prompt, and a client that can show forms asks with an approval form whose one box starts unticked. Where a client can do neither, the model's `confirm: true` counts, and `TELEGRAM_CONFIRM=model` makes it enough everywhere. They stay off until `TELEGRAM_ALLOW_DESTRUCTIVE=1`, as in 0.4.
- **The channel declares itself where Claude Code looks.** 0.4 declared `claude/channel` at the top level of its capabilities, and Claude Code reads it under `experimental`, so the channel never registered. Now it does, and it tells the model to answer with `reply` and the event's `chat_id`.
- **Telegram's failures keep their exit codes**, now with Slipway's `code`: no credentials 10, a revoked session 4, a missing chat 3, a flood wait 7 with `retry_after_seconds`, a refused write 2, and anything else from Telegram 5. An unknown command exits 2, where 0.4.4 exited 1.
- **Less to install and start.** npx installs 50 packages instead of 139. The server spends 290 ms of CPU before its first answer where 0.4.4 spent 312, and answers in 204 ms of wall time instead of 216 (median of 21 runs, taking turns on one Mac).
- **`TELEGRAM_TOOLSETS` picks modules by name**, such as `topics` or `folders`, for an MCP client and the CLI alike, beside `TELEGRAM_TOOLS`, which still decides only what an MCP client loads.
- **`--http` refuses to serve anywhere but 127.0.0.1 without `TELEGRAM_HTTP_TOKEN`**, where 0.4.4 served without one, and refuses a page from another site unless `TELEGRAM_HTTP_ALLOWED_ORIGINS` lists it. `install <client>` adds the server to Claude Code, Codex, Claude Desktop, Cursor, VS Code or Gemini CLI in each one's own format.
- **Docs.** The README's costs are measured against 0.4.4, and its settings table lists every variable. 0.4's docs said every account-scoped tool took an `account` argument to reach a second session; none did, and the README now says so. `SKILL.md` lists `which`, exit code 1 and the 13 daily commands with the toolsets that hold the rest, where it hand-listed 51 of the 74, and costs 2,293 tokens in Claude Code instead of 2,581.

What did not get better: Claude Code's default, with tool search, costs the same within its noise, a median of 124 tokens a message against 123 across nine runs a side, where single runs ranged from 115 to 128. Both versions send the same 13 tool names and no instructions; 0.5.0 adds its display title. And the command list `telegram-cli` prints is 169 tokens longer, 959 against 790 o200k, for a heading over each of the 13 toolsets.

### Upgrading

Node 22 or later is required; 0.4.4 ran on 20. Over MCP, expect an approval prompt or form before an irreversible call; a headless agent that should pass `confirm: true` alone needs `TELEGRAM_CONFIRM=model`. An error in the terminal is one JSON object with `error`, Slipway's lowercase `code` (`not_configured`, `auth`, `rate_limited`, `not_found`) and often a `hint`, where 0.4.4 printed uppercase codes. A flood wait's seconds are in `retry_after_seconds`. A missing argument's error is 12 tokens longer, for its code and a hint.

## 0.4.4, 2026-10-04

- **`npx -y @thenavidm/telegram-mcp-cli` always starts the MCP server.** npx starts whichever binary the npm registry lists first when they share one file, and the registry does not keep the published order, so an MCP client set up with this README's install line could get `telegram-cli` and its command list instead of a server. A third binary named after the package now always starts the server, and npx picks it by name.

## 0.4.3

Fixes the bug that cancelled the session on the hosted connector.

- **HTTP sessions share one Telegram connection.** Each MCP session built its
  own client, so two clients at once put the same auth key on the wire twice.
  Telegram answers that with `AUTH_KEY_DUPLICATED` and cancels the session on
  every machine holding it.
- **`AUTH_KEY_DUPLICATED` says what happened.** It now reads as an auth error
  with the fix: log in again, one session string per machine.
- **Commands exit when they finish.** GramJS kept its socket open after a call,
  so a command printed its answer and then hung. `doctor` also has a deadline,
  because a broken setup is exactly when GramJS retries forever.
- **Nothing but output on stdout.** GramJS printed a version banner from its
  constructor, before the log level could be lowered. It landed in front of
  `--json` output, in the MCP stream on the first call, and in front of the
  session string in `telegram-mcp login > session.txt`.
- **A list of numbers works on the command line.** `--message-ids 1` reached
  the tool as the text "1" and failed validation, so `delete`, `forward`, the
  scheduled-message cancel and folder ordering could only run over MCP.
- **A refused write exits 2.** With destructive tools off, `delete` exited 5
  as if Telegram had failed.
- **The README shows the context cost measured in Claude Code**, and Claude
  Desktop's short way in: the `.mcpb` extension on each release.

## 0.4.2

Fixes the bug that made the hosted connector unusable.

- **A server instance is now built per session.** One `McpServer` was connected
  to every new transport, which the SDK refuses, so the process crashed the
  moment a client opened a second session. A hand-run curl only ever opens one,
  which is why it passed every test and returned 502s in practice.

## 0.4.1

- **A bare `GET` answers 405 rather than 400.** Clients probe the endpoint
  before opening a session. That reached the SDK, which built a throwaway
  transport and replied `Server not initialized` with a 400, and the client
  read it as "not an MCP server".

## 0.4.0

The channel surface, which is the part nobody else has.

- **`telegram-mcp --channel`** pushes real Telegram messages into a Claude Code
  session that is already open. The official Telegram channel is a BotFather
  bot and can only see messages sent to that bot; this is backed by MTProto, so
  an event can come from any chat you are actually in.
- **Nothing forwards until a chat is allowed.** `allow_chat` opts one in. That
  default is deliberate: without it every message in every group becomes model
  input, which is both expensive and a prompt-injection surface.
- **Personas.** Each allowed chat can carry a name, delivered on the event as
  `persona`, so one session can answer as a different assistant depending on
  which chat a message came from.
- The channel keeps its MCP surface up when Telegram is unreachable, rather
  than exiting, so a bad session reports itself instead of disappearing.
- The publish workflow no longer fails a tag when `NPM_TOKEN` is unset or the
  version is already on npm. Both skip with a notice.
- The README comparison no longer names other projects.

## 0.3.0

Full capability coverage.

- **74 tools, up from 54.** Forum topics, inline buttons, stickers, GIFs,
  albums, contact cards, transcription, folder CRUD, contact import and export,
  and privacy writes.
- **Several accounts.** `TELEGRAM_SESSION_<LABEL>` adds one, and every
  account-scoped tool takes an optional `account`.
- **HTTP transport.** `telegram-mcp --http` for an always-on process. Binds to
  loopback and takes a bearer token, because a process holding a session string
  should not be reachable from the network.
- **`core` is still 13 tools and still 2,218 tokens.** Third release in a row
  where the default did not move.

| Profile | Tools | Every turn |
|---|---|---|
| `core` (default) | 13 | 2,218 |
| `read` | 31 | 4,673 |
| `full` | 74 | 11,643 |
| CLI | all 74 | 175 |

For comparison, the leading Telegram MCP server is 127 tools at 21,096 tokens,
with no CLI and no way to load fewer.


## 0.2.0

Full capability coverage, without moving what the default costs.

- **54 tools, up from 13.** Contacts, groups and admin, reactions, pins, polls,
  scheduled messages, archive, mute, folders, drafts, profile and privacy.
- **`core` is still 13 tools and still 2,218 tokens.** New tools land in `full`,
  so the default profile did not get more expensive. Measured, not assumed.
- `read` now covers 24 reading tools at 3,710 tokens. `full` is 54 at 8,502.
- The CLI reaches all 54 for 175 tokens of standing cost.
- Capabilities are collapsed onto arguments rather than split across tools:
  `get_participants` filters to admins or banned, `set_admin` demotes with
  `promote: false`, `set_banned` unbans, `pin` unpins, `react` clears,
  `archive` and `mute` both reverse, and `save_draft` clears with an empty
  string.
- Irreversible additions are guarded like the rest: `leave_chat`,
  `delete_contact`, `set_banned`, `delete_history`, `delete_scheduled` and
  `delete_profile_photo` all need confirmation and `TELEGRAM_ALLOW_DESTRUCTIVE=1`.

## 0.1.0

First release.

- MCP server and CLI over MTProto, signed in as a real account rather than a bot
- 13 tools in the `core` profile: chats, history, search, send, edit, delete,
  forward, mark read, media download and upload, resolve, whoami
- Tool profiles (`core`, `full`, `read`) so context cost is a configuration
  choice. Measured: 13 tools is about 2,218 tokens of `tools/list`
- Responses projected to flat rows rather than raw MTProto entities, with
  previews, cursor pagination and `--fields` projection
- Write guard: irreversible tools refuse without confirmation and are off
  entirely unless `TELEGRAM_ALLOW_DESTRUCTIVE=1`
- `FLOOD_WAIT` parsed into a retry-after rather than surfaced as a stack trace
- Control, zero-width and bidi characters stripped from inbound message text
