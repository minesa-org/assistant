# Mini App Template (mini-interaction ≥ 0.10)

Starter template for Discord HTTP-interaction apps built on **auto-discovery**:
drop handler files into `src/commands`, `src/components` or `src/modals` and
`MiniInteraction` picks them up automatically — no manual router wiring needed.

## What's inside

| Path | Purpose |
| --- | --- |
| `api/interactions.ts` | 3-line interactions endpoint — `MiniInteraction` handles everything |
| `api/index.ts` | Linked-roles landing page (`index.html`) |
| `api/discord-oauth-callback.ts` | OAuth2 callback: stores tokens in `MiniDatabase`, updates role metadata |
| `src/commands/ping.ts` | `/ping` — Components V2 container + section + button |
| `src/commands/echo.ts` | `/echo` — typed option resolver demo |
| `src/components/ping_button.ts` | Button → modal with a modal-side select menu |
| `src/components/ping_menu.ts` | Select menu component handler |
| `src/modals/ping_modal.ts` | Modal submit handler |
| `scripts/register.ts` | Registers commands & linked-role metadata via `mini.registerCommands()` |

## 1. Prepare

```bash
npm install
cp env.example .env   # then fill in the values
```

## 2. Register commands & metadata

```bash
npm run register
```

Set `DISCORD_GUILD_ID` to register instantly on one guild; leave it unset for
global registration.

## 3. Deploy to Vercel

```bash
npm install -g vercel
vercel login && vercel link
vercel --prod
```

Then in the [Developer Portal](https://discord.com/developers/applications):

- **Interactions Endpoint URL** → `https://<your-app>/api/interactions`
- **OAuth2 redirect** → `https://<your-app>/api/discord-oauth-callback`

> [!TIP]
> Importing the repository into Vercel and adding the environment variables is
> even easier — no CLI needed.

## Adding features

1. Create a handler file under `src/commands`, `src/components` or `src/modals`
   (see any existing file for the shape).
2. Add the command payload to `scripts/register.ts`.
3. That's it — `MiniInteraction` auto-discovers new files on the next request.
