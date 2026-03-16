#!/usr/bin/env node
/**
 * Registers Telegram webhooks for every bot after deployment.
 *
 * Required env vars (in .dev.vars locally, or real env vars in CI):
 *   WORKER_URL       — e.g. https://telegram-bots.yoursubdomain.workers.dev
 *   BOT_WAME_TOKEN
 *   BOT_NANA_TOKEN
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const devVarsPath = resolve(__dirname, "../.dev.vars");

// Load .dev.vars when running locally (values already in env take priority)
try {
  const lines = readFileSync(devVarsPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=");
    if (key && value && !(key in process.env)) process.env[key] = value;
  }
} catch {
  // No .dev.vars — rely on real env vars
}

// ---------------------------------------------------------------------------
// Bot registry — add new bots here, matching the routes in src/index.js
// ---------------------------------------------------------------------------
const BOTS = [
  { name: "WaMe",     tokenEnv: "BOT_WAME_TOKEN", path: "/bot_wame"     },
  { name: "NanaCalc", tokenEnv: "BOT_NANA_TOKEN",  path: "/bot_nana" },
];

const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
if (!workerUrl) {
  console.error("Error: WORKER_URL is not set.");
  console.error("Add it to .dev.vars, e.g.:");
  console.error("  WORKER_URL=https://telegram-bots.yoursubdomain.workers.dev");
  process.exit(1);
}

let allOk = true;
for (const bot of BOTS) {
  const token = process.env[bot.tokenEnv];
  if (!token) {
    console.warn(`Warning: ${bot.tokenEnv} not set — skipping ${bot.name}`);
    allOk = false;
    continue;
  }

  const webhookUrl = `${workerUrl}${bot.path}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const json = await res.json();
    if (json.ok) {
      console.log(`✓  ${bot.name} → ${webhookUrl}`);
    } else {
      console.error(`✗  ${bot.name}: ${json.description}`);
      allOk = false;
    }
  } catch (err) {
    console.error(`✗  ${bot.name}: ${err.message}`);
    allOk = false;
  }
}

process.exit(allOk ? 0 : 1);
