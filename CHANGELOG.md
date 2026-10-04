# Changelog

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
