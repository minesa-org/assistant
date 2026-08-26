# Roadmap

Mini-interaction targets **HTTP/webhook interactions only** — no gateway,
no voice, no presences. This document tracked what discord.js offers that was
missing here; **every item below has shipped as of the v0.6–v0.9 releases**
(mirrored by GitHub issues #1–#24). It is kept as a record of the parity work.

## v0.6 — Router & interaction completeness

The biggest gap today. Everything below works over HTTP and is the first
thing discord.js users will look for:

- [x] **Autocomplete interactions** (`InteractionType.ApplicationCommandAutocomplete`):
      `router.onAutocomplete(commandName, handler)` plus a
      `respondChoices()` helper that answers with `{ type: 8, data: { choices } }`
      and focus-aware option detection (`getFocusedOption()`).
- [x] **Context-menu & primary-entry-point dispatch in `InteractionRouter`**:
      it currently only routes chat-input commands by name; User/Message context
      menus (keyed by `name`) and Primary Entry Point commands fall through silently.
- [x] **Wrapped interactions in router dispatch**: handlers currently receive raw
      `APIChatInputApplicationCommandInteraction` objects; they should receive the
      same helper-augmented interactions as the compat layer (option resolver,
      `reply`, `deferReply`, ...).
- [x] **Pattern-based component ids**: `onComponent('config:*', handler)` /
      regex matching so dynamic custom ids don't need one registration each.
- [x] **Middleware & error hooks**: `router.use(...)` for pre-dispatch work and
      `router.onError(...)` to turn handler exceptions into a safe user-facing reply.
- [x] **Modal submit getters for new components** on `ModalSubmitInteraction`:
      `getRadioGroupValue(id)` (string | undefined), `getCheckboxGroupValues(id)`
      (string[]), `getCheckboxValue(id)` (boolean), `getFileUploadValues(id)`
      — the current generic helpers only cover text inputs and select menus.
- [x] **Follow-up deletion**: `deleteOriginal()` / `deleteFollowup(messageId)`
      on `InteractionContext` and `DiscordRestClient` (DELETE webhook message endpoints).
- [x] **MIGRATION.md**: referenced in the changelog but missing from the repo.

## v0.7 — Messages & channels REST surface

- [x] `fetchMessage`, `fetchMessages({ limit, before, after, around })` with pagination.
- [x] `bulkDeleteMessages(channelId, ids)` (2–100 messages endpoint).
- [x] `triggerTyping(channelId)`.
- [x] Channel management lite: `fetchChannel`, `editChannel` (name/topic/slowmode/nsfw),
      `deleteChannel`, `followAnnouncementChannel`.
- [x] Reaction management: list reactors (`GET .../reactions/{emoji}`), remove own/all reactions.
- [x] **Polls**: poll object in send options, `endPoll(channelId, messageId)`,
      fetch answer voters — fully HTTP-compatible, discord.js parity feature.
- [x] Attachment/CDN helpers: build attachment URLs, avatar/banner/icon URL builders
      (discord.js `CDN` class equivalents).

## v0.8 — Guilds & moderation REST

- [x] Members: `fetchMember`, `kick`, `ban`/`unban` (+ ban list), `timeout`
      (communication_disabled_until), role add/remove.
- [x] Roles: create/edit/delete/list, position reordering.
- [x] Guild basics: fetch guild, list channels, list members (paginated).
- [x] Emoji & sticker CRUD.
- [x] Webhook management: create/list/delete channel webhooks; execute incoming
      webhooks with components (`with_components=true`).
- [x] **Entitlements & SKUs**: list/consume entitlements — pairs with the existing
      Premium button support for monetized mini-apps.
- [x] Application command permission endpoints
      (`PUT /applications/{id}/guilds/{gid}/commands/{cid}/permissions`).

## v0.9+ — Platform hardening & DX

- [x] **Rate-limit bucket handling**: parse `X-RateLimit-*` headers, serialise per
      bucket, handle global 429s and `retry_after` from JSON bodies (discord.js
      RequestManager-style queueing instead of plain retry).
- [x] Snowflake utilities: `snowflakeToTimestamp`, id generation checks.
- [x] Test suite + CI: unit tests for builders/payload normalisation (pure functions),
      GitHub Actions running typecheck/build/tests, npm publish workflow on version tags.
- [x] Localisation ergonomics: typed locale-key maps shared across commands/options/embeds.
- [x] Interaction response timeout guard as a first-class option on every handler.

## Intentionally out of scope

Gateway/websocket events, voice, presences, sharding — mini-interaction stays a
stateless HTTP-interaction framework for serverless deployments (Vercel et al.).
