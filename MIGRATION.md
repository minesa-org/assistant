# Migration Guide

## From legacy `MiniInteraction` to the core/router stack

The legacy `MiniInteraction` class (still exported as
`LegacyMiniInteractionAdapter`) keeps working for backwards compatibility.
New code should use the modular stack:

```ts
// Before (legacy, all-in-one)
const mini = new MiniInteraction({ commandsDirectory: "commands" });
export default mini.createNodeHandler();

// After (modular)
import {
  DiscordRestClient,
  InteractionContext,
  InteractionRouter,
  verifyAndParseInteraction,
} from "@minesa-org/mini-interaction";

const rest = new DiscordRestClient({
  applicationId: process.env.DISCORD_APPLICATION_ID,
  token: process.env.DISCORD_BOT_TOKEN,
});

const router = new InteractionRouter({ rest })
  .onCommand("ping", async (interaction, ctx) => ctx.reply({ content: "Pong!" }))
  .onComponent("my_button", async (interaction, ctx) => ctx.reply({ content: "Clicked!" }))
  .onModal("my_modal", async (interaction, ctx) => ctx.reply({ content: "Submitted!" }));

export async function POST(req: Request) {
  const interaction = await verifyAndParseInteraction({ /* ... */ });
  if (interaction.type === 1) return Response.json({ type: 1 });

  const ctx = new InteractionContext({ interaction, rest });
  const response = await router.dispatch(interaction, ctx);
  return Response.json(response ?? ctx.deferReply());
}
```

### Key differences

| Legacy | Modular |
|---|---|
| File-system auto-discovery of `commands/` / `components/` directories | Explicit `router.onCommand/onComponent/onModal` registrations |
| Handlers receive loosely typed wrappers | Handlers receive fully typed wrapped interactions + `InteractionContext` |
| Modal detection by file naming (`*.modal.ts`) | Explicit `onModal` registration |

## v0.5 breaking changes

### Radio & checkbox components

The invented component types were replaced by Discord's real modal components:

- `RADIO_COMPONENT_TYPE` is now **21** (`RadioGroup`), not `2001`.
- `CheckboxBuilder` now builds a **single checkbox** (type 23): only
  `setCustomId()` and `setDefault()`.
- The former options-array checkbox moved to the new **`CheckboxGroupBuilder`**
  (type 22): options must be 2–10 and support `minValues`/`maxValues`.
- `RadioBuilder` enforces Discord's 2–10 option limit; `setDisabled()` was
  removed (not valid on modal radio groups); option emoji was dropped per spec.

```ts
// Before (invalid payload, rejected by Discord)
new CheckboxBuilder().addOptions({ label: "A", value: "a" });

// After — single checkbox
new CheckboxBuilder().setCustomId("tos").setDefault(false);

// After — multi-option group
new CheckboxGroupBuilder().setCustomId("prefs")
  .addOptions({ label: "Email", value: "email" }, { label: "Push", value: "push" });
```

### Modal select menus

- `disabled` is no longer serialised (Discord rejects it on modal selects);
  `setDisabled()` remains but is deprecated and ignored.
- `placeholder` is validated against the 150-character limit.

### Components V2

- Sending a Components V2 message together with `content`, `embeds` or
  `sticker_ids` now throws — use TextDisplay components instead.
- `ModalBuilder` accepts top-level TextDisplay alongside ActionRow and Label.

## v0.6 router changes

- `InteractionRouter` handlers now receive **wrapped interactions** (option
  resolver, reply helpers) instead of raw API payloads.
- Context menus and Primary Entry Point commands are dispatched via
  `onUserCommand`, `onMessageCommand` and `onEntryPointCommand`.
- Autocomplete is handled via `onAutocomplete` with an `AutocompleteContext`.
