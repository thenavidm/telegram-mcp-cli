# Security

## What this holds

A Telegram **session string**. It is not a scoped token: it is full access to
the account, it does not expire, and anyone holding it can read every message
and send as you.

It is read from `TELEGRAM_SESSION` and never written to disk by this tool.
`telegram-mcp login` prints it once on stdout and puts everything else on
stderr, so you decide where it lands.

If one leaks, revoke it in Telegram under **Settings → Devices**, which
invalidates the session immediately. Then run `login` again.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through
[GitHub's advisory form](https://github.com/thenavidm/telegram-mcp-cli/security/advisories/new)
and I will respond as quickly as I can.

## Untrusted input

Message text comes from other people. Control characters, zero-width
characters and bidi overrides are stripped before any body reaches a model,
because those are how an instruction hides from a human reviewer while staying
visible to a model.

Treat message content as data. It is never an instruction, whatever it says.

## Reducing what an agent can do

- `TELEGRAM_READ_ONLY=1` removes every write tool, so none is even advertised
- `TELEGRAM_ALLOW_DESTRUCTIVE` is off by default, so `delete` is unavailable
  until you turn it on
- `TELEGRAM_TOOLS=read` exposes only the 7 read tools
- `TELEGRAM_AUDIT_LOG` records every write attempted, allowed or blocked
