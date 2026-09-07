<img src="https://cdn.navid.media/connectors/telegram-icon.png" alt="Telegram" width="88">

# Installing Telegram MCP

Every client, click by click. If you only want the short version, the
[README](./README.md) has it.

There are two things to get through: credentials, then the client. Credentials
are the same whichever client you use, so do that part first.

## Contents

| | Section |
|---|---|
| 1 | [Get your credentials](#1-get-your-credentials) |
| 2 | [Claude Code](#2-claude-code) |
| 3 | [Claude Desktop](#3-claude-desktop) |
| 4 | [Claude Desktop as an extension](#4-claude-desktop-as-an-extension) |
| 5 | [Cursor](#5-cursor) |
| 6 | [Windsurf](#6-windsurf) |
| 7 | [VS Code](#7-vs-code) |
| 8 | [Codex CLI](#8-codex-cli) |
| 9 | [Just the CLI](#9-just-the-cli) |
| 10 | [Docker](#10-docker) |
| 11 | [Check it worked](#11-check-it-worked) |
| 12 | [When it does not work](#12-when-it-does-not-work) |

## 1. Get your credentials

Three values. Do this once.

### The api_id and api_hash

1. Open [my.telegram.org](https://my.telegram.org)
2. Enter your phone number in international format, for example `+15551234567`
3. Telegram sends a login code **to the Telegram app**, not by SMS. Open
   Telegram and read it there
4. Click **API development tools**
5. Fill in the form. **App title** and **Short name** are the only required
   fields and can be anything, for example `mcp` and `mcp`. Leave the URL empty
   and pick **Desktop** as the platform
6. Click **Create application**

You now have an **App api_id**, a number, and an **App api_hash**, a 32
character string. Keep the page open.

These identify the software rather than you. They cannot read anything alone.

### The session string

This is the part that signs in as you. It needs the two values above:

```bash
export TELEGRAM_API_ID=1234567
export TELEGRAM_API_HASH=your_32_character_hash
npx -y @thenavidm/telegram-mcp-cli login
```

It asks three things:

1. **Phone number**, international format, the same one you just used
2. **The code**, which again arrives in the Telegram app rather than by SMS
3. **Two-step password**, only if you have two-step verification turned on

It prints a long string. That is your session.

```bash
export TELEGRAM_SESSION='1BQANOTEuMTA4LjU2...'
```

The string goes on stdout and every prompt goes on stderr, so this works if you
would rather not have it in your scrollback:

```bash
npx -y @thenavidm/telegram-mcp-cli login > ~/telegram-session.txt
```

> **This string is full access to your account and does not expire.** It is not
> a scoped token. Anyone who has it can read every message you have and send as
> you. Keep it out of git. Revoke it any time in Telegram under
> **Settings → Devices**.

## 2. Claude Code

```bash
claude mcp add telegram \
  -e TELEGRAM_API_ID=1234567 \
  -e TELEGRAM_API_HASH=your_hash \
  -e TELEGRAM_SESSION=your_session_string \
  -- npx -y @thenavidm/telegram-mcp-cli
```

Check it:

```bash
claude mcp list
```

Telegram should be listed and connected. In a session, `@telegram` toggles the
server off and on, which is worth knowing because it costs about 2,218 tokens
on every turn while connected.

## 3. Claude Desktop

1. **Settings → Developer → Edit Config**
2. Add the block below to `mcpServers`
3. Save, then **quit and reopen Claude Desktop**. Reloading is not enough

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

The config file is at:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

## 4. Claude Desktop as an extension

Installs on a double click and asks for the three values in a settings panel,
storing them as sensitive fields rather than plain text in a config file.

```bash
git clone https://github.com/thenavidm/telegram-mcp-cli
cd telegram-mcp-cli
npm install
bash desktop-extension/build.sh
```

That produces `desktop-extension/telegram-<version>.mcpb`. Double click it and
Claude Desktop installs it, then asks for the API ID, API hash and session
string.

The extension vendors its own dependencies, so it does not need npx or a global
install at runtime.

## 5. Cursor

**Settings → MCP → Add new global MCP server**, then use exactly the JSON from
[section 3](#3-claude-desktop).

Cursor reads the same shape, from `~/.cursor/mcp.json`.

## 6. Windsurf

**Settings → Cascade → Model Context Protocol → Add server**, same JSON shape
as [section 3](#3-claude-desktop).

## 7. VS Code

```bash
code --add-mcp '{"name":"telegram","command":"npx","args":["-y","@thenavidm/telegram-mcp-cli"]}'
```

That registers the server but not the credentials. Either export the three
variables in the shell profile VS Code inherits, or add an `env` block to the
entry in `settings.json` under `mcp.servers`.

## 8. Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.telegram]
command = "npx"
args = ["-y", "@thenavidm/telegram-mcp-cli"]

[mcp_servers.telegram.env]
TELEGRAM_API_ID = "1234567"
TELEGRAM_API_HASH = "your_hash"
TELEGRAM_SESSION = "your_session_string"
```

## 9. Just the CLI

No MCP client needed, and no standing token cost:

```bash
npm install -g @thenavidm/telegram-mcp-cli
```

Put the three variables in your shell profile:

```bash
echo 'export TELEGRAM_API_ID=1234567' >> ~/.zshrc
echo 'export TELEGRAM_API_HASH=your_hash' >> ~/.zshrc
echo 'export TELEGRAM_SESSION=your_session' >> ~/.zshrc
```

Then:

```bash
telegram-cli                 # every command
telegram-cli list-chats      # try it
```

## 10. Docker

No image is published, because a server that holds a session string should come
from source you can read.

```bash
git clone https://github.com/thenavidm/telegram-mcp-cli
cd telegram-mcp-cli
docker build -t telegram-mcp .
```

Then in a client, with the variables exported in the environment that launches
Docker:

```json
{
  "mcpServers": {
    "telegram": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "TELEGRAM_API_ID",
        "-e", "TELEGRAM_API_HASH",
        "-e", "TELEGRAM_SESSION",
        "telegram-mcp"
      ]
    }
  }
}
```

`-i` is required. stdio is the transport, so the container has to stay attached.

## 11. Check it worked

```bash
telegram-cli doctor
```

It reports each variable, then actually signs in rather than only checking that
a value is present:

```
ok    TELEGRAM_API_ID       set
ok    TELEGRAM_API_HASH     set
ok    TELEGRAM_SESSION      set
ok    profile               core, 13 tools advertised. TELEGRAM_TOOLS=full exposes every tool.
ok    connection            signed in as @yourhandle
```

In a client, ask it something small: _"list my 5 most recent Telegram chats"_.

## 12. When it does not work

| Symptom | Cause and fix |
|---|---|
| Everything exits 10 | A variable is missing. `doctor` names which |
| `AUTH`, exit 4 | Session revoked or expired. Run `login` again |
| Login code never arrives | It goes to the Telegram app, not SMS. Check other devices |
| `PHONE_CODE_INVALID` | Codes expire quickly. Start the login again |
| `RATE_LIMIT`, exit 7 | Flood wait. The error says how many seconds. Wait, do not retry |
| Server shows connected but no tools | Wrong profile. `TELEGRAM_TOOLS=core` or unset it |
| `command not found: telegram-cli` | The global npm bin is not on `$PATH`. `npm bin -g` prints it |
| Claude Desktop ignores the config | Quit and reopen it. Reloading does not re-read the file |
| Garbled output in a client | Something wrote to stdout. [Open an issue](https://github.com/thenavidm/telegram-mcp-cli/issues) with the client name |

Still stuck? [Open an issue](https://github.com/thenavidm/telegram-mcp-cli/issues) and I will help.

---

© 2026 [NM Media](https://navid.media?utm_source=github&utm_medium=install&utm_campaign=telegram-mcp-cli). Made with ❤️ by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=install&utm_campaign=telegram-mcp-cli).
