# Changelog

## 0.1.0

First release.

- MCP server and CLI over MTProto, signed in as a real account rather than a bot
- 13 tools in the `core` profile: chats, history, search, send, edit, delete,
  forward, mark read, media download and upload, resolve, whoami
- Tool profiles (`core`, `full`, `read`) so context cost is a configuration
  choice. Measured: 13 tools is about 2,500 tokens of `tools/list`, 7 is 1,400
- Responses projected to flat rows rather than raw MTProto entities, with
  previews, cursor pagination and `--fields` projection
- Write guard: irreversible tools refuse without confirmation and are off
  entirely unless `TELEGRAM_ALLOW_DESTRUCTIVE=1`
- `FLOOD_WAIT` parsed into a retry-after rather than surfaced as a stack trace
- Control, zero-width and bidi characters stripped from inbound message text
