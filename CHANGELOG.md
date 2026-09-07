# Changelog

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
