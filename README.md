<img src="https://cdn.navid.media/connectors/telegram-icon.png" alt="Telegram" width="88">

# Telegram MCP Server & CLI

[![npm](https://img.shields.io/npm/v/@thenavidm/telegram-mcp-cli?color=orange&label=npm)](https://www.npmjs.com/package/@thenavidm/telegram-mcp-cli)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

Telegram MCP server and CLI for Claude Code and AI agents. 74 tools for chats, history, search, sending, media, contacts, groups, admin, topics, reactions, polls, folders and privacy, on your real account.

One install gives you both surfaces, the same tools under the same names,
covering what the app does rather than what a bot is allowed to see.

Most Telegram integrations are bots, and a bot only ever receives messages sent
to that bot. Your own conversations are invisible to it. This signs in as you
over MTProto, so an agent can read the group you were actually talking in and
answer in it.

Built and maintained by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli).

<img src="https://cdn.navid.media/repos/telegram-mcp-cli.gif?v=3" alt="Claude Code using the Telegram MCP server" width="520">

## Two ways to use it

### Command line

`telegram-cli` in your terminal, for scripting, cron, pipes, or just asking a
quick question without opening anything:

```bash
telegram-cli                                       # every command, one line each
telegram-cli list-chats --unread-only --limit 10   # what needs an answer
telegram-cli history --peer @sarah --limit 20      # one conversation
telegram-cli search --query invoice                # across every chat
telegram-cli send --peer me --text "note to self"  # Saved Messages
telegram-cli list-chats --json | jq -r '.items[].name'
telegram-cli <command> --help                      # what any command takes
```

`--confirm` is the shell spelling of the confirmation that deleting requires.
`--json` gives JSON, `--compact` puts it on one line, and errors are JSON on
stderr whichever you pick.

Reads return real objects rather than rendered text, so `--json` hands you
fields you can filter, and `--fields id,text` cuts the response before it is
ever printed.

### MCP server, for AI agents

`telegram-mcp` is what Claude Code, Claude Desktop, Cursor and the rest launch.
You never run it by hand:

```bash
claude mcp add telegram \
  -e TELEGRAM_API_ID=1234567 \
  -e TELEGRAM_API_HASH=your_hash \
  -e TELEGRAM_SESSION=your_session_string \
  -- npx -y @thenavidm/telegram-mcp-cli
```

Then just ask: _"what did I miss in the group chats while I was asleep?"_

Every other client is in [section 4](#4-connect-your-client-).

### Which one

| Where you are | What you can reach |
|---|---|
| An agent that can run shell commands, like Claude Code or Cursor | Both. The CLI is the cheaper one: 175 tokens a turn against 2,218 |
| claude.ai, the Claude Desktop chat tab, or a phone | The server only. There is no shell to run a command in |
| A terminal, a script, cron or CI | The CLI only. There is no MCP client in a shell |

They are the same program reading the same tool definitions, so anything one
can do, the other can.

## Features

Every tool is both a command and an MCP tool, with the same name. The command
is the tool name with dashes.

| Capability | CLI command | MCP tool |
|---|---|---|
| Who am I | `telegram-cli whoami` | `whoami` |
| Resolve a handle or id | `telegram-cli resolve` | `resolve` |
| List chats | `telegram-cli list-chats` | `list_chats` |
| One chat's details | `telegram-cli get-chat` | `get_chat` |
| Read history | `telegram-cli history` | `history` |
| Search messages | `telegram-cli search` | `search` |
| Send a message | `telegram-cli send` | `send` |
| Edit a message | `telegram-cli edit` | `edit` |
| Delete messages | `telegram-cli delete` | `delete` |
| Forward messages | `telegram-cli forward` | `forward` |
| Mark a chat read | `telegram-cli mark-read` | `mark_read` |
| Download media | `telegram-cli download-media` | `download_media` |
| Send a file | `telegram-cli send-file` | `send_file` |
| Check your setup | `telegram-cli doctor` | not a tool |
| Sign in once | `telegram-mcp login` | not a tool |

All 13 with their arguments are in [section 7](#7-tools).

## Contents

| | Section | |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it) | Real prompts, not features |
| 2 | [Quick install](#2-quick-install-) | Node 20 and one command |
| 3 | [Set up your account](#3-set-up-your-account-) | api_id, api_hash, session string |
| 4 | [Connect your client](#4-connect-your-client-) | Every client, copy and paste |
| 5 | [Output and exit codes](#5-output-and-exit-codes) | What scripts branch on |
| 6 | [Which surface, and what each costs](#6-which-surface-and-what-each-costs) | 2,218 tokens a turn, or 175 |
| 7 | [Tools](#7-tools) | All 13, with arguments |
| 8 | [Writing safely](#8-writing-safely) | Why deleting asks twice |
| 9 | [Reading messages](#9-reading-messages) | The output format, and why |
| 10 | [How it works](#10-how-it-works) | Architecture |
| 11 | [Your data](#11-your-data) | What is stored and where |
| 12 | [Risks](#12-risks) | Read this before you install |
| 13 | [Troubleshooting](#13-troubleshooting) | When something breaks |
| 14 | [FAQ](#14-faq-) | Including what an MCP server is |

## 1. What you can ask it

Real prompts, not a feature list. Each of these is one or two tool calls.

> What did I miss in the group chats while I was asleep?

> Find the last thing Sarah sent me about the invoice and reply that I will
> look at it tonight.

> Search every chat for the wifi password someone sent me last year.

> Which conversations have unread messages, and which actually need an answer
> rather than an emoji?

> Save the PDF that Tom sent me this morning to my desktop.

> Send myself a note in Saved Messages with these three links.

The reading tools are the ones worth having on. Searching a decade of chat for
a thing you half remember is what this is genuinely better at than scrolling.

## 2. Quick install ⚡

Node 20 or newer. Nothing else.

```bash
npx -y @thenavidm/telegram-mcp-cli@latest --version
```

That is the whole install. `npx` fetches it on demand, so there is nothing to
update later. Prefer it on your `$PATH`?

```bash
npm install -g @thenavidm/telegram-mcp-cli
```

Installing needs no account. Only signing in does, which is the next section.

### Before you start

| You need | Check with | If missing |
|---|---|---|
| Node 20 or newer | `node -v` | [nodejs.org](https://nodejs.org) |
| A Telegram account | Open the app | Any account works, no Premium needed |
| A phone you can receive a code on | | The code arrives **in the Telegram app**, not by SMS |

> [!IMPORTANT]
> You need an api_id from [my.telegram.org](https://my.telegram.org), not a bot
> token from BotFather. A bot cannot read your chats, which is the entire point
> of this. [Section 3](#3-set-up-your-account-) walks through it.

## 3. Set up your account 🔑

Three values. The first two identify the application, the third is you.

### The api_id and api_hash

Go to [my.telegram.org](https://my.telegram.org), sign in with your phone
number, open **API development tools**, and fill in the short form. Any app name
and a short description are fine. You get an `api_id` and an `api_hash`.

These identify the software, not you, and they are not especially secret. They
cannot read anything on their own.

### The session string

```bash
export TELEGRAM_API_ID=1234567
export TELEGRAM_API_HASH=your_hash_here
npx -y @thenavidm/telegram-mcp-cli login
```

It asks for your phone number, the code Telegram sends you, and your two-step
password if you have one. It prints the session string on stdout and everything
else on stderr, so `telegram-mcp login > session.txt` captures only the string.

```bash
export TELEGRAM_SESSION='the string it printed'
```

### What that string is

**Full access to your account, and it does not expire.** It is not a token
scoped to some permissions, it is your login. Anyone holding it can read every
message you have and send as you.

Keep it out of repos. Put it in your MCP client's config, which is a file only
you can read, rather than in a shell profile that gets committed by accident.

### Revoking

Telegram, **Settings → Devices**. The session shows up as a logged-in device
and terminating it invalidates the string immediately. Do that if it leaks, or
whenever you stop using this, then run `login` again if you come back.

## 4. Connect your client 🔌

```bash
npm install -g @thenavidm/telegram-mcp-cli
```

Or run it without installing anything:

```bash
npx -y @thenavidm/telegram-mcp-cli
```

Node 20 or newer.

### Claude Code

```bash
claude mcp add telegram \
  -e TELEGRAM_API_ID=1234567 \
  -e TELEGRAM_API_HASH=your_hash \
  -e TELEGRAM_SESSION=your_session_string \
  -- npx -y @thenavidm/telegram-mcp-cli
```

### Claude Desktop

Settings → Developer → Edit Config, then add:

```json
{
  "mcpServers": {
    "telegram": {
      "command": "npx",
      "args": ["-y", "@thenavidm/telegram-mcp-cli"],
      "env": {
        "TELEGRAM_API_ID": "1234567",
        "TELEGRAM_API_HASH": "your_hash",
        "TELEGRAM_SESSION": "your_session_string"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

### Claude Desktop, as an extension

Build the `.mcpb` and double click it, which installs without touching JSON:

```bash
git clone https://github.com/thenavidm/telegram-mcp-cli
cd telegram-mcp-cli && npm install
bash desktop-extension/build.sh
```

It asks for the three values in a settings panel and stores them as sensitive
fields rather than plain text in a config file.

### Cursor

Settings → MCP → Add new global MCP server, using the same JSON as Claude
Desktop.

### Windsurf

Settings → Cascade → Model Context Protocol, same JSON shape.

### VS Code

```bash
code --add-mcp '{"name":"telegram","command":"npx","args":["-y","@thenavidm/telegram-mcp-cli"]}'
```

Then set the three environment variables in your shell profile, or add an `env`
block to the entry.

### Anything else

Any client that speaks MCP over stdio. The command is
`npx -y @thenavidm/telegram-mcp-cli` with the three variables in the
environment.

### Docker

```bash
docker build -t telegram-mcp .
docker run --rm -i \
  -e TELEGRAM_API_ID -e TELEGRAM_API_HASH -e TELEGRAM_SESSION \
  telegram-mcp
```

### Check it worked

```bash
telegram-cli doctor
```

It names any missing variable, says where to get it, and signs in to confirm
the session actually works rather than only that it is present.

## 5. Output and exit codes

### What gets printed

Reads return objects. A list comes back as `{count, next_cursor, items}`, so
paging is a field rather than something you infer.

```bash
telegram-cli list-chats --limit 3 --fields name,unread
```

```json
{
  "count": 3,
  "items": [
    { "name": "Sarah", "unread": 2 },
    { "name": "Design", "unread": 14 },
    { "name": "Mum", "unread": 1 }
  ]
}
```

Errors are JSON on stderr, with the code and often a hint:

```json
{
  "error": "Telegram rate limited this account. Wait 42s.",
  "code": "RATE_LIMIT",
  "retryAfter": 42,
  "hint": "Flood waits are per method and get longer if you keep calling. Wait it out."
}
```

### Exit codes

A script branches on the number.

| Code | Means |
|---|---|
| 0 | Fine |
| 2 | Bad usage, or a write refused for want of `--confirm` |
| 3 | No such chat, user or message |
| 4 | The session is invalid or expired |
| 5 | Telegram rejected the call, or forbade it |
| 7 | Rate limited, `retryAfter` says how long |
| 10 | Nothing configured yet |

## 6. Which surface, and what each costs

Both surfaces carry the same tools. They differ in when you pay for them.

| | MCP server | CLI |
|---|---|---|
| Loaded every turn | **2,218 tokens** | 175 tokens |
| Loaded when Telegram comes up | nothing more | 1,271 more, once |
| Listing the commands | included | 155, once |
| Reading one command's arguments | included | 209, once |
| Works on claude.ai and mobile | yes | no, there is no shell there |
| Works in a script, cron or CI | no | yes |
| You invoke it by | asking in plain language | typing a command |

An MCP server sends its whole tool list to the model on **every turn**, whether
you mention Telegram or not. That is the price of being connected at all,
before you ask anything.

The CLI is not free either, and it is worth being honest about that. Its shell
skill carries a description that loads every turn so the agent knows the command
exists. That is 175 tokens rather than 2,218, and the rest is only read when
Telegram actually comes up.

Over 20 turns where Telegram comes up once, that is **44,360 tokens against
5,135**. When the whole conversation is Telegram, the gap closes and the server
is the better experience, because you ask in plain language instead of
remembering flags.

Every number here came from a real `tools/list` handshake against this build,
counted with a tokeniser rather than estimated from character length.

### Where the 2,218 goes

Worth knowing, because most of it is not something anyone can write away:

| Part of the payload | Share |
|---|---|
| JSON Schema structure: types, required lists, nesting | **70%** |
| Argument descriptions | 16% |
| Tool descriptions | 14% |

Roughly 1,550 tokens are the protocol serialising every tool as JSON Schema.
Any MCP server with this many tools pays the same. The 30% that is prose is
what makes the tools usable without guessing.

For contrast, a Telegram MCP server shipping 80 tools pays that structural cost
eight times over, on every turn, before anyone asks it anything.

### How this compares

There are a dozen or so Telegram MCP servers. They cluster into three shapes,
and the trade each one makes is worth understanding before picking any of them,
including this one.

| | This server | Minimal servers | Comprehensive servers | Official channel plugin |
|---|---|---|---|---|
| Tools | 13 default, 74 available | 2 to 8 | up to 127 | n/a, a chat bridge |
| Tokens every turn | **2,218**, or 11,643 at full | ~400 to 1,500 | up to **21,096** | small |
| Reads your real chats | yes | yes | yes | **no, bot only** |
| CLI surface | **yes, all 74** | no | no | no |
| Choose what loads | **yes, profiles** | fixed | fixed | n/a |
| Runs unconfigured | **yes, self-diagnoses** | varies | often crashes at import | n/a |
| Transports | stdio, HTTP | stdio, some HTTP | stdio, HTTP, SSE | stdio |

Every number in the first and fourth columns was measured against a running
server with a tokeniser, not read off a README.

**Minimal servers** collapse everything into a handful of very general tools,
sometimes with a raw MTProto escape hatch. That is genuinely cheap and it is a
reasonable design. The cost is discoverability: a model has to know the API to
drive one general tool correctly, and the errors when it guesses wrong are
worse than a missing tool.

**Comprehensive servers** go the other way, one tool per operation. Everything
is discoverable, and you pay for all of it on every turn whether Telegram comes
up or not. At the top of the range that is 21,096 tokens standing.

**This one refuses the trade.** Tools are named and discoverable like the
comprehensive servers, but you choose how many load. The default is 13. The
long tail lives in the CLI, which costs 175 tokens standing because a shell
command is not sent to the model until it is typed.

**The official channel plugin is a different thing entirely.** It is a
BotFather bot, so it can only ever see messages sent to that bot. Your own
chats, groups and history are invisible to it. It is a good way to talk *to*
Claude from your phone, and no way at all to let Claude read your Telegram.

### Where the capability goes

Coverage does not require one tool per operation. Capabilities ride on
arguments instead:

| One tool here | Replaces |
|---|---|
| `get_participants --filter admins\|banned\|kicked\|bots` | 4 separate tools |
| `set_admin --promote false` | promote and demote |
| `set_banned --ban false` | ban and unban |
| `pin --pin false` | pin and unpin |
| `react` with no emoji | react and remove reaction |
| `archive` / `mute`, both reversible | 4 tools |
| `update_folder --add --remove` | add to folder, remove from folder |
| `save_draft ""` | save and clear |

That is how the same ground is covered by 74 definitions rather than 127.

### Spending less

**Pick a smaller profile.** `TELEGRAM_TOOLS` decides what is advertised:

| Profile | Tools | Every turn |
|---|---|---|
| `core` (default) | 13 | 2,218 tokens |
| `read` | 31 | 4,673 tokens |
| `full` | 74 | 11,643 tokens |

**Turn the server off when you are not using Telegram.** In Claude Code that is
`@telegram` to toggle, and every client has an equivalent.

**Or install the CLI and skip the server.** Every tool stays reachable and the
standing cost falls from 2,218 to 175, which is the single biggest lever here.

**Shape the responses.** Once you are actually using it, `--fields id,text` and
a small `--limit` matter more than the tool list. See
[section 9](#9-reading-messages).

## 7. Tools

Every tool, with its arguments. Each is also a shell command under the same name
with dashes, so `list_chats` runs as `telegram-cli list-chats`.

Two things hold across all of them. Every list tool takes `fields` for
projection and a `limit` that is clamped rather than trusted. Every tool that
changes something is marked, and the irreversible one needs confirmation.

### Account

| Tool | Arguments | What it does |
|---|---|---|
| `whoami` | none | Which account this session is signed in as |
| `resolve` | `peer` | A @username, phone or id to something you can act on |

### Chats

| Tool | Arguments | What it does |
|---|---|---|
| `list_chats` | `limit`, `unread_only`, `kind`, `fields` | Recent conversations, newest first |
| `get_chat` | `peer` | One chat: name, kind, username, member count |

### Reading

| Tool | Arguments | What it does |
|---|---|---|
| `history` | `peer`, `limit`, `before_id`, `full`, `fields` | Messages from one chat, newest first |
| `search` | `query`, `peer`, `limit`, `fields` | Search text in one chat or everywhere |
| `download_media` | `peer`, `message_id`, `dir` | Save a photo, video, document or voice note |

### Writing

| Tool | Arguments | What it does |
|---|---|---|
| `send` | `peer`, `text`, `reply_to`, `silent` | Send a message. Posts as you |
| `send_file` | `peer`, `path`, `caption` | Send a local file |
| `edit` | `peer`, `message_id`, `text` | Change a message you sent |
| `forward` | `from`, `to`, `message_ids` | Forward between chats |
| `mark_read` | `peer` | Clear a chat's unread count |
| `delete` ⚠️ | `peer`, `message_ids`, `revoke`, `confirm` | Delete messages. Cannot be undone |

`peer` is the same everywhere: a `@username`, a numeric id, or `me` for Saved
Messages.

## 8. Writing safely

Writes are on, and guarded. Shipping no writes is not safety, it just moves the
work back to you. Shipping them unguarded is worse, because `send` posts as you
to a real person and `delete` with revoke removes messages for everyone in the
chat, not only your copy.

So: reversible writes run. `delete` refuses without an explicit confirmation,
and the refusal names the right syntax for wherever you are, `--confirm` in a
terminal and `confirm: true` in a tool call.

### Turning writes off entirely

```bash
TELEGRAM_READ_ONLY=1
```

Write tools are not merely refused, they are never registered, so the model
cannot see them and will not try. That drops the tool list to the 7 reads.

`TELEGRAM_ALLOW_DESTRUCTIVE` is off by default and separate: `delete` is
unavailable until you turn it on, even with writes enabled.

### Annotations

Every tool sets its MCP annotations explicitly rather than letting them default.
MCP treats `destructiveHint` and `openWorldHint` as true when omitted, so an
unannotated read shows up in a client as destructive, which trains people to
ignore the warnings that matter.

### An audit log

```bash
TELEGRAM_AUDIT_LOG=~/telegram-writes.jsonl
```

One line per write attempted, allowed or blocked, with the tool, a one-line
summary and the outcome. Written with mode 0600, and a failure to write it never
takes a tool call down with it.

### Prompt injection

Message text is written by other people and reaches the model as input. Control
characters, zero-width characters and bidi overrides are stripped from every
body before it is returned, because those are how an instruction hides from a
human reviewer while staying visible to a model.

Treat message content as data. It is never an instruction, whatever it says.

## 9. Reading messages

Nothing raw is ever returned, and that is deliberate rather than lossy.

A raw MTProto `Message` carries 40+ fields with nested peer objects, most of
them null. A raw dialog list of 200 chats is thousands of tokens of noise. So
chats and messages are projected to flat rows of 6 to 10 fields:

```json
{
  "id": 8412,
  "date": "2026-09-06T18:22:04.000Z",
  "from": "Sarah",
  "text": "sent the invoice over, let me know",
  "reply_to": 8409,
  "media": "document"
}
```

Four levers, in the order they matter:

- **`fields`** keeps only what you name. `--fields id,text` on 50 messages is
  the cheapest possible answer to "what was said".
- **`limit`** defaults to 20, not 100, and is clamped rather than trusted.
- **Bodies are truncated** to a preview unless you pass `full`.
- **`next_cursor`** pages rather than returning a whole history. Pass it back as
  `before_id`.

A shaped chat row is around 30 tokens where the raw object is 300. That ratio is
why this section exists.

## 10. How it works

```
                    ALL_TOOLS  (one array, tools/index.ts)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    server.ts         cli.ts          channel.ts
   MCP over stdio   shell commands    (planned)
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                    WriteGuard  →  TelegramApi  →  MTProto
```

One array of tool definitions feeds every surface. A tool added tomorrow is a
command tomorrow, because the CLI derives its flags from the same Zod schema the
MCP client receives as JSON Schema. `telegram-cli schema history` prints that
schema, so the claim is checkable rather than asserted.

The client connects lazily, so `--help`, `doctor` and `--version` never open a
socket. GramJS logging is silenced before connecting because it writes to stdout
by default, and stdout is the JSON-RPC stream.

## 11. Your data

Nothing leaves your machine except calls to Telegram's own servers. There is no
backend here, no account to create, and no telemetry.

| What | Where |
|---|---|
| Your session string | Wherever you put it. Never written to disk by this tool |
| The audit log | Only if you set `TELEGRAM_AUDIT_LOG`, at that path, mode 0600 |
| Downloaded media | Where you asked for it, default the working directory |
| Message content | Held in memory for the length of one call |

`telegram-mcp login` prints the session on stdout and nothing else, precisely so
that you decide where it lands rather than the tool choosing for you.

## 12. Risks

Worth reading before you install, not after.

**The session string is your account.** Not a scoped token. If it leaks,
whoever has it can read everything and send as you, until you revoke it under
Settings → Devices.

**An agent with this connected can message real people.** That is the point,
and it is also the risk. `TELEGRAM_READ_ONLY=1` exists for when you are pointing
something you do not fully trust at it.

**Message text is untrusted input.** Sanitising helps and is not a guarantee.
Anything you would not want a model to act on unquestioned should not be in a
chat it can read.

**Telegram rate limits hard.** `FLOOD_WAIT` on a new session is normal, the
waits get longer if you keep calling, and an automated retry loop can get an
account limited for hours. The error carries `retryAfter` so a caller can wait
the right amount instead of guessing.

**Automating a user account is not what a bot account is.** Telegram's terms
allow user clients, but bulk or spammy behaviour through one is what gets
accounts limited. This is built for reading your own chats and answering them.

## 13. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `NOT_CONFIGURED`, exit 10 | One of the three variables is missing. `telegram-cli doctor` names it |
| `AUTH`, exit 4 | Session revoked or expired. Run `login` again |
| `RATE_LIMIT`, exit 7 | Flood wait. The error says how many seconds. Wait, do not retry |
| `NOT_FOUND` on a peer | Use `resolve` or `list_chats` to get a valid id first |
| The server starts then exits | Usually a bad session string. `doctor` connects and will say so |
| Garbled JSON-RPC in a client | Something is writing to stdout. Open an issue with the client name |
| `delete` refuses | By design. `--confirm`, and `TELEGRAM_ALLOW_DESTRUCTIVE=1` |

## Environment variables

**Credentials**

| Variable | What it is |
|---|---|
| `TELEGRAM_API_ID` | From my.telegram.org, API development tools |
| `TELEGRAM_API_HASH` | Issued with the api_id, same page |
| `TELEGRAM_SESSION` | From `telegram-mcp login`. Full account access |

**Safety**

| Variable | What it does |
|---|---|
| `TELEGRAM_READ_ONLY=1` | Never registers a write tool, so the model cannot see one |
| `TELEGRAM_ALLOW_DESTRUCTIVE=1` | Permits `delete` at all. Off by default |
| `TELEGRAM_AUDIT_LOG` | Append-only record of every write attempted, allowed or blocked |

**Tuning**

| Variable | What it does |
|---|---|
| `TELEGRAM_TOOLS` | `core` (default), `full`, or `read`. Decides context cost |
| `TELEGRAM_TIMEOUT` | Per-call deadline in seconds, default 30 |

**Several accounts**

| Variable | What it does |
|---|---|
| `TELEGRAM_SESSION_<LABEL>` | A second account, for example `TELEGRAM_SESSION_WORK`. Reach it with the `account` argument |

Every account-scoped tool takes an optional `account`, matched loosely against
the label, so one server can hold a personal and a work account rather than
running two.

**Pushing messages into a session**

| Variable | What it does |
|---|---|
| `TELEGRAM_CHANNEL_ALLOW` | Allowlist path for `--channel`, default `~/.telegram-mcp/channel-allow.json` |

```bash
telegram-mcp --channel
```

Runs as a Claude Code channel, pushing real Telegram messages into a session
that is already open. The official Telegram channel is a bot, so it only sees
messages sent to that bot. This one is backed by your account, so an event can
come from any chat you are actually in.

Nothing is forwarded until you allow a chat, which the `allow_chat` tool does.
That default matters: without it every message in every group you are in
becomes model input, which is both expensive and a prompt-injection surface.

Each allowed chat can carry a persona name, and it arrives on the event as
`persona`, so one session can answer as a different assistant depending on
which chat the message came from.

**Running it always on**

| Variable | What it does |
|---|---|
| `TELEGRAM_HTTP_PORT` | Port for `--http`, default 8787 |
| `TELEGRAM_HTTP_HOST` | Interface for `--http`, default `127.0.0.1` |
| `TELEGRAM_HTTP_TOKEN` | Bearer token required on every HTTP request |

```bash
telegram-mcp --http --port=8787
```

Binds to loopback, because a process holding a session string should not be
reachable from the network. Moving it off loopback without setting
`TELEGRAM_HTTP_TOKEN` hands your account to anyone who can route to the port.

## Running it 24/7

For claude.ai, your phone, or the channel, the server has to be reachable when
the call happens. `deploy/install.sh` sets that up on a Linux box:

```bash
sudo bash deploy/install.sh
sudo nano /etc/telegram-mcp.env
sudo systemctl start telegram-mcp
```

Own user, own directory, port 8788 bound to loopback only, systemd unit that
restarts on failure and starts on boot. Put your reverse proxy in front of
`127.0.0.1:8788`.

`telegram-mcp login` runs on your laptop, not the server: it asks for a phone
code interactively. Paste the session string into the env file.

Worth knowing: **a Telegram session does not expire and needs no live
connection.** The process can be down for a month and reconnect with the same
string. A server buys reachability, not session survival, so if you only use
the CLI you do not need one at all.

## Versions

See [CHANGELOG.md](CHANGELOG.md).

## 14. FAQ ❓

<details>
<summary><b>What is an MCP server?</b></summary>

An MCP server is a standard way to give an AI assistant real access to a tool,
so it can act rather than guess. You install it once, your assistant gains the
tools, and it works in Claude, Cursor and anything else that speaks the
protocol. You never call the tools yourself, you just ask in plain language.

</details>

<details>
<summary><b>How is this different from a Telegram bot?</b></summary>

A bot is a separate account, and it only receives messages that people send to
that bot. It cannot read your conversations, your groups, or anything that
happened before it existed.

This signs in as you, over the same protocol the official apps use. Every chat
you are in, all of the history, and search across it.

</details>

<details>
<summary><b>Is this allowed? Will it get my account banned?</b></summary>

Telegram publishes the client API at my.telegram.org specifically so people can
build clients, and third-party clients are common and long-standing.

What gets accounts limited is behaviour, not the API: bulk messaging, spam, mass
adding people. Reading your own chats and answering them is what this is for.
Rate limits are real and the tool surfaces them rather than retrying into them.

</details>

<details>
<summary><b>What is a session string and why does it need one?</b></summary>

Telegram authenticates a user by sending a code to an existing session, so there
is a one-time interactive login. What comes out is a session string, which is
how the tool signs in afterwards without asking again.

It is full access to the account and does not expire. Treat it exactly as you
would your password, and revoke it under Settings → Devices when you are done.

</details>

<details>
<summary><b>Do I need a bot token from BotFather?</b></summary>

No. BotFather issues bot tokens, and a bot is the thing this deliberately is
not. You need an api_id and api_hash from my.telegram.org, which is a different
page and a different kind of credential.

</details>

<details>
<summary><b>Is my data sent anywhere? Who can see it?</b></summary>

Nothing leaves your machine except calls to Telegram. There is no backend here,
no account to create and no telemetry. Your session sits in your client's config
file and the audit log, if you enable one, sits where you pointed it.

</details>

<details>
<summary><b>Can it message people without me asking?</b></summary>

It only acts when a model calls a tool, and a model only calls one in response
to something you said. The risk is not spontaneity, it is misreading: a request
to "reply to everyone" doing more than you meant.

That is what the guard is for. `delete` refuses without explicit confirmation,
`TELEGRAM_ALLOW_DESTRUCTIVE` keeps it off entirely by default, and
`TELEGRAM_READ_ONLY=1` removes every write tool from the list.

</details>

<details>
<summary><b>Why only 13 tools when other Telegram servers have 80?</b></summary>

Because every tool definition is sent to the model on every turn, whether you
use it or not. 80 tools is 15,000 to 25,000 tokens of standing cost, and it
makes tool selection worse: a model picks correctly from 13 far more reliably
than from 80.

The 13 cover what actually gets used. The long tail belongs in the CLI, where it
costs nothing until you type it.

</details>

<details>
<summary><b>Can I use several Telegram accounts?</b></summary>

Not yet. One session per server instance today. You can run a second instance
with a different session string under a different name in your client config,
which works but is clumsier than it should be.

</details>

<details>
<summary><b>Does it work with Telegram Premium features?</b></summary>

Reading and sending work the same either way. Premium-only features like longer
messages and larger uploads follow whatever your account already has, because
this is your account rather than a bot with its own limits.

</details>

<details>
<summary><b>Why does it need Node 20?</b></summary>

The MCP TypeScript SDK and GramJS both target modern Node. 20 is the oldest
line still receiving security updates at the time of writing.

</details>

## Questions

Run into a problem or have a question? [Open an issue](https://github.com/thenavidm/telegram-mcp-cli/issues) and I will help.

## About the author

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. This Telegram MCP server is one piece of that system.

**Links**

- Personal website: [navid.me](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli)
- Link in bio: [navid.bio](https://navid.bio?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli)
- Navid Media: [navid.media](https://navid.media?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

If this is useful, star the repo and come say hi on [X](https://x.com/thenavidm).

## Dependencies

| Library | License | What it does |
|---|---|---|
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | The MCP server and transports |
| [GramJS](https://github.com/gram-js/gramjs) | MIT | The MTProto client, published as `telegram` |
| [zod](https://github.com/colinhacks/zod) | MIT | Tool argument schemas and validation |
| [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema) | ISC | Turns those schemas into what an MCP client receives |

## License

[MIT](./LICENSE). Free to use, modify, and share.

Not affiliated with, endorsed by, or connected to Telegram Messenger Inc.

---

© 2026 [NM Media](https://navid.media?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli). Made with ❤️ by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=telegram-mcp-cli).
