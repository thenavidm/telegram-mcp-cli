# Telegram MCP and CLI

[![npm](https://img.shields.io/npm/v/@thenavidm/telegram-mcp-cli?color=orange&label=npm)](https://www.npmjs.com/package/@thenavidm/telegram-mcp-cli)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

Telegram MCP server and CLI for Claude Code and AI agents. Your real account over MTProto: every chat, full history, search, sending, media and contacts.

Most Telegram integrations are bots. A bot only ever sees messages sent to that bot, which means your own conversations are invisible to it. This signs in as you, so an agent can read the group you were actually talking in and answer in it.

One server, two surfaces. The MCP server is what an AI app launches. The CLI is the same tools as shell commands, reading the same tool definitions, so they cannot drift.

13 tools in the default profile, about 2,500 tokens of context.

## Contents

| # | Section |
| --- | --- |
| 1 | [Two surfaces](#two-surfaces) |
| 2 | [Context cost](#context-cost) |
| 3 | [Install](#install) |
| 4 | [Getting credentials](#getting-credentials) |
| 5 | [Tools](#tools) |
| 6 | [Environment variables](#environment-variables) |
| 7 | [Safety](#safety) |
| 8 | [Questions](#questions) |
| 9 | [About the author](#about-the-author) |
| 10 | [License](#license) |

## Two surfaces

As an MCP server, launched by an AI app:

```bash
claude mcp add telegram -- npx -y @thenavidm/telegram-mcp-cli
```

Then ask for something that needs it:

> Find the last thing Sarah sent me about the invoice, and reply that I will
> look at it tonight.

As a CLI, in a terminal or a script:

```bash
telegram-cli list-chats --unread-only --limit 5
telegram-cli history --peer @sarah --limit 20 --fields id,from,text
telegram-cli search --query invoice --limit 10
telegram-cli send --peer me --text "note to self"
```

Every tool is a command, because both read one array of definitions. A tool
added tomorrow is a command tomorrow.

```bash
telegram-cli                    # every command, one line each, writes marked
telegram-cli history --help     # flags derived from the schema
telegram-cli schema history     # the exact JSON Schema an MCP client receives
```

## Context cost

Every tool definition is sent to the model on every turn, so tools are rent
rather than a one-off cost. Measured from a real `tools/list` handshake:

| Profile | Tools | `tools/list` | Roughly |
| --- | --- | --- | --- |
| `read` | 7 | 5,602 chars | ~1,400 tokens |
| `core` (default) | 13 | 10,085 chars | ~2,500 tokens |
| `full` | 13 | 10,085 chars | ~2,500 tokens |

Set the profile with `TELEGRAM_TOOLS`. `core` covers daily use and is the
default. The long tail belongs in the CLI, where it costs no context at all.

Responses are shaped as hard as the tool list. A raw MTProto message carries
40+ fields with nested peer objects, and a raw dialog list is mostly nulls, so
nothing raw is ever returned. Chats and messages come back as flat rows of 6 to
10 fields, bodies truncated to a preview unless you ask for `--full`, lists
paginated with a cursor, and `--fields id,text` cuts it further. A shaped chat
row is around 30 tokens where the raw object is 300.

## Install

```bash
npm install -g @thenavidm/telegram-mcp-cli
```

Or run it without installing:

```bash
npx -y @thenavidm/telegram-mcp-cli
```

Node 20 or newer.

## Getting credentials

Three values. The first two identify the application, the third is you.

1. **api_id and api_hash.** Go to [my.telegram.org](https://my.telegram.org),
   sign in, open **API development tools**, and create an application. Any name
   works. You get an `api_id` and an `api_hash`.

2. **A session string.** Run the login once:

   ```bash
   export TELEGRAM_API_ID=1234567
   export TELEGRAM_API_HASH=your_hash_here
   telegram-mcp login
   ```

   It asks for your phone number, the code Telegram sends you, and your
   two-step password if you have one. It prints a session string on stdout and
   everything else on stderr, so `telegram-mcp login > session.txt` captures
   just the string.

3. **Set it:**

   ```bash
   export TELEGRAM_SESSION='the string it printed'
   ```

Then check the setup:

```bash
telegram-mcp doctor
```

It names any missing variable, says where to get it, and signs in to confirm
the session works.

**The session string is full access to your account and does not expire.** It
is not a token scoped to some permissions, it is your login. Keep it out of
repos, out of shell history where you can, and revoke it from Telegram under
Settings, Devices if it ever leaks.

## Tools

Run `telegram-cli` for the current list. At the time of writing, the `core`
profile is 13:

| Tool | Risk | What it does |
| --- | --- | --- |
| `whoami` | read | Which account this session is |
| `resolve` | read | A @username, phone or id to a chat you can act on |
| `list_chats` | read | Recent conversations, with unread counts and previews |
| `get_chat` | read | One chat: name, kind, member count |
| `history` | read | Messages from a chat, newest first, paginated |
| `search` | read | Search message text, one chat or everywhere |
| `download_media` | read | Save a photo, video, document or voice note |
| `send` | write | Send a message |
| `edit` | write | Change a message you sent |
| `mark_read` | write | Clear a chat's unread count |
| `forward` | write | Forward messages between chats |
| `send_file` | write | Send a local file |
| `delete` | irreversible | Delete messages, needs confirmation |

## Environment variables

**Credentials**

| Variable | What it is |
| --- | --- |
| `TELEGRAM_API_ID` | From my.telegram.org, API development tools |
| `TELEGRAM_API_HASH` | Issued with the api_id, same page |
| `TELEGRAM_SESSION` | From `telegram-mcp login`. Full account access |

**Safety**

| Variable | What it does |
| --- | --- |
| `TELEGRAM_READ_ONLY=1` | Removes every write tool, so none is even advertised |
| `TELEGRAM_ALLOW_DESTRUCTIVE=1` | Permits the irreversible tools at all. Off by default |
| `TELEGRAM_AUDIT_LOG` | Append-only record of every write attempted, allowed or blocked |

**Tuning**

| Variable | What it does |
| --- | --- |
| `TELEGRAM_TOOLS` | `core` (default), `full`, or `read`. Decides context cost |
| `TELEGRAM_TIMEOUT` | Per-call deadline in seconds, default 30 |

## Safety

Writes are on, and guarded. Shipping no writes is not safety, it just moves the
work back to you. Shipping them unguarded is worse, because `send` posts as you
to a real person and `delete` with revoke removes messages for everyone.

So: reversible writes run. Irreversible ones refuse without an explicit
confirmation, and the refusal names the right syntax for wherever you are,
`--confirm` in a terminal and `confirm: true` in a tool call. Irreversible
tools are additionally off entirely unless `TELEGRAM_ALLOW_DESTRUCTIVE=1`.

Message text from other people is untrusted input. Control characters,
zero-width characters and bidi overrides are stripped before any message body
reaches the model, because those are how text hides an instruction from a human
reviewer while staying visible to a model.

Rate limits are Telegram's, not this tool's. `FLOOD_WAIT` is normal on a new
session, and the wait in seconds is parsed out and returned rather than buried
in a stack trace, so a caller can wait the right amount instead of retrying
into a longer ban.

## Questions

Run into a problem or have a question? [Open an issue](https://github.com/thenavidm/telegram-mcp-cli/issues) and I will help.

## About the author

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. This Telegram MCP server is one piece of that system.

**Links**

- Personal website: [navid.me](https://navid.me)
- Link in bio: [navid.bio](https://navid.bio)
- Navid Media: [navid.media](https://navid.media)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

If this is useful, star the repo and come say hi on [X](https://x.com/thenavidm).

## License

[MIT](./LICENSE). Free to use, modify, and share.

Not affiliated with, endorsed by, or connected to Telegram Messenger Inc.

---

© 2026 [NM Media](https://navid.media). Made with ❤️ by [Navid Moazzez](https://navid.me).
