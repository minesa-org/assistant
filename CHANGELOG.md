# Changelog

## Unreleased

## 0.9.0 - 2026-08-24
### Added
- Bucket-aware rate limiting in `DiscordRestClient`: learns `X-RateLimit-*` budgets per route, waits for bucket resets before spending calls, and honours `retry_after` from 429 bodies.
- Snowflake utilities: `snowflakeToTimestamp`, `snowflakeToDate`, `isValidSnowflake`, `DISCORD_EPOCH`.
- Localisation helpers: `createLocalizationMap` (fully typed against Discord locales), `mergeLocalizationMaps`, and `resolveLocalization` with exact → base-language → default fallback.
- CI workflow (typecheck + tests + build on Node 20/22) and an npm publish workflow triggered by version tags.
### Added
- Guild basics: `fetchGuild` (with counts), `listGuildChannels`.
- Members & moderation: `fetchMember`, `listMembers`, `kickMember`, `banMember`/`unbanMember`, `listBans`, `editMember`, `timeoutMember`.
- Roles: `listRoles`, `createRole`, `editRole`, `deleteRole`, `reorderRoles`, `addRoleToMember`, `removeRoleFromMember`.
- Emoji & stickers: `listGuildEmojis`, `fetchGuildEmoji`, `createGuildEmoji`, `editGuildEmoji`, `deleteGuildEmoji`, `listGuildStickers`, `fetchSticker`, `deleteGuildSticker`.
- Webhooks management: `listChannelWebhooks`, `listGuildWebhooks`, `createWebhook`, `fetchWebhook`, `fetchWebhookWithToken`, `editWebhook`, `deleteWebhook`.
- Monetization: `listSKUs`, `listEntitlements`, `consumeEntitlement`.
- Command permissions: `getCommandPermissions`, `setCommandPermissions`.
### Added
- Message reads & bulk operations: `fetchMessage`, `fetchMessages` (before/after/around pagination), `bulkDeleteMessages` (2–100).
- Typing & reaction management: `triggerTyping`, `fetchReactors`, `removeOwnReaction`, `removeUserReaction`, `removeAllReactions`, `removeAllReactionsForEmoji`.
- Channel endpoints: `fetchChannel`, `editChannel` (incl. thread archive/lock), `deleteChannel`, `followAnnouncementChannel`.
- Polls: `poll` option on all message sends, `endPoll`, and `fetchPollAnswerVoters`.
- CDN URL builders: `avatarURL`, `defaultAvatarURL`, `userBannerURL`, `guildIconURL`, `guildBannerURL`, `guildSplashURL`, `emojiURL`, `stickerURL`, `attachmentURL`.
### Added
- **Router v2** (`InteractionRouter`): handlers now receive wrapped interactions with option resolvers and reply helpers; context menus and Primary Entry Point commands route via `onUserCommand`, `onMessageCommand` and `onEntryPointCommand`.
- Autocomplete support: `router.onAutocomplete()` with `AutocompleteContext` (`getFocusedOption()`, `respond(choices)` producing the `type: 8` response).
- Pattern-based component custom ids: glob prefixes (`config:*`, longest match wins) and regex matchers, with exact ids taking priority.
- Router middleware (`router.use`) and error hooks (`router.onError`), plus a fallback handler (`router.onFallback`).
- Modal submit getters for new form components: `getRadioGroupValue`, `getCheckboxGroupValues`, `getCheckboxValue`, `getFileUploadValues`.
- Follow-up deletion: `rest.deleteOriginal`/`deleteFollowup` and `ctx.deleteOriginal()`/`ctx.deleteFollowup()`.
- `MIGRATION.md` covering legacy-to-modern stack migration and v0.5+ breaking changes.

## 0.5.0 - 2026-08-24

### Breaking changes

- Reworked interaction architecture around `core/http`, `core/interactions`, `router`, and `compat` modules.
- Builder validation now throws hard `ValidationError` for out-of-spec payloads.
- `ModalBuilder` no longer auto-wraps arbitrary components into action rows; top-level components must be ActionRow, TextDisplay or Label.
- Radio/checkbox contracts now match Discord's real components: RadioGroup (type 21), CheckboxGroup (type 22) and Checkbox (type 23). The previous `2001`/`2002` type values were invalid and rejected by the API.
- `CheckboxBuilder` now builds the single-checkbox component (`custom_id` + `default` only). The former options-array model moved to the new `CheckboxGroupBuilder` (options 2-10, `min_values`/`max_values`).

### Added

- Discord markdown helpers: `bold`, `italic`, `underline`, `strikethrough`, `inlineCode`, `codeBlock`, `blockQuote`, `multilineBlockQuote`, `spoiler`, `subtext`, `heading`, `bulletList`, `numberedList`, `maskLink`, `timestamp`, `userMention`, `roleMention`, `channelMention`, `slashCommandMention` and `escapeMarkdown`.
- `DiscordRestClient.createThread` for creating threads directly in a channel (forum/standalone threads) alongside the existing message-based `startThread`.
- `DiscordRestClient.editMessage`, `deleteMessage`, `pinMessage`, `unpinMessage`, `crosspostMessage` and `sendWebhookMessage` convenience methods.
- `DiscordSentMessage.edit`, `delete`, `reply` (with `message_reference` support), `pin`, `unpin` and `crosspost` helpers.
- `DiscordWebhook.edit` and `DiscordWebhook.delete` for webhook-sent messages.
- Reply support via `messageReference` on all message send options.
- `DiscordRestClient` with retry + rate-limit behavior.
- `InteractionContext` lifecycle helpers for reply/defer/showModal/edit/followUp.
- `InteractionRouter` command/component/modal dispatch.
- Architecture docs.

### Fixed

- `RadioBuilder` now enforces Discord's 2-10 option limit and no longer serialises `disabled`, which is not accepted on modal radio groups. Option emoji was dropped per the component spec.
- Modal select menus (`Modal*SelectMenuBuilder`) no longer serialise `disabled` (not valid in modals) and validate `placeholder` against the 150-character limit; message-side select builders gained the same placeholder check.
- `COMPONENTS_V2_TYPES` detection now only contains real message Components V2 types (Section, TextDisplay, Thumbnail, MediaGallery, File, Separator, Container); modal-only Label/FileUpload/RadioGroup/CheckboxGroup were removed from message V2 detection.
- Sending a Components V2 message with `content`, `embeds` or `sticker_ids` now throws instead of producing an API error.
