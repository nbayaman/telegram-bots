# telegram-bots

A single Cloudflare Worker hosting multiple Telegram bots. Each bot lives in its own file under `src/bots/` and is routed by URL path.

## Project structure

```
src/
├── index.js          ← entry point — routes requests to the right bot
└── bots/
    ├── wame.js       ← WaMe bot: phone number → wa.me / t.me links
    └── nana.js       ← NanaCalc bot: CNY price → USD with 50% markup
scripts/
└── set-webhooks.js   ← registers Telegram webhooks after deployment
wrangler.toml
.dev.vars.example
```

## Adding a new bot

1. Create `src/bots/mybot.js` — export `handleMyBot(request, token)` following the pattern in `wame.js`.
2. Add a route in `src/index.js`:
   ```js
   if (pathname === "/bot_mybot") {
     return handleMyBot(request, env.BOT_MYBOT_TOKEN);
   }
   ```
3. Add the bot to the registry in `scripts/set-webhooks.js`:
   ```js
   { name: "MyBot", tokenEnv: "BOT_MYBOT_TOKEN", path: "/bot_mybot" },
   ```
4. Add a placeholder to `.dev.vars.example` and your real token to `.dev.vars`.

## Local development

```bash
cp .dev.vars.example .dev.vars
# fill in .dev.vars with real tokens and WORKER_URL
npm run dev
```

Use a tool like [ngrok](https://ngrok.com) or `wrangler dev --remote` to expose a public URL for testing webhooks locally.

## Deployment

```bash
# First deploy: add secrets once
npx wrangler secret put BOT_WAME_TOKEN
npx wrangler secret put BOT_NANA_TOKEN

# Deploy + auto-register webhooks
npm run deploy
```

`npm run deploy` runs `wrangler deploy` and then automatically calls `scripts/set-webhooks.js` to register all webhook URLs with Telegram.

To re-register webhooks without redeploying:

```bash
npm run webhooks
```

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `BOT_WAME_TOKEN` | Wrangler secret | Telegram token for the WaMe bot |
| `BOT_NANA_TOKEN` | Wrangler secret | Telegram token for the NanaCalc bot |
| `WORKER_URL` | `.dev.vars` / CI env | Base URL of the deployed worker, e.g. `https://telegram-bots.yoursubdomain.workers.dev` |

Secrets are never stored in `wrangler.toml`. The `WORKER_URL` is only needed at webhook-registration time — it does not need to be a Worker secret.
