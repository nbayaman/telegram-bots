#!/usr/bin/env node
/**
 * Registers Telegram webhooks for every bot after deployment.
 *
 * Tokens are imported directly from each bot's source file.
 * Required CI env vars (provided automatically by Cloudflare Pages/Workers):
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { TOKEN as WAME_TOKEN } from "../src/bots/wame.js";
import { TOKEN as NANA_TOKEN } from "../src/bots/nana.js";
import { TOKEN as MEDIATUSHUR_TOKEN } from "../src/bots/mediatushur.js";

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
    { name: "WaMe", token: WAME_TOKEN, path: "/bot_wame" },
    { name: "NanaCalc", token: NANA_TOKEN, path: "/bot_nana" },
    { name: "MediaTushur", token: MEDIATUSHUR_TOKEN, path: "/bot_mediatushur" },
];

// ---------------------------------------------------------------------------
// Resolve WORKER_URL
// If not set explicitly, derive it from the Cloudflare API using the
// CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID that wrangler already injects
// into the CI build environment.
// ---------------------------------------------------------------------------
let workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");

if (!workerUrl) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (apiToken && accountId) {
        // Read worker name from wrangler.toml
        const toml = readFileSync(resolve(__dirname, "../wrangler.toml"), "utf8");
        const nameMatch = toml.match(/^name\s*=\s*"([^"]+)"/m);
        const workerName = nameMatch?.[1];

        if (workerName) {
            // Ask CF API for this account's workers.dev subdomain
            const subRes = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
                { headers: { Authorization: `Bearer ${apiToken}` } }
            );
            const subJson = await subRes.json();
            const subdomain = subJson.result?.subdomain;

            if (subdomain) {
                workerUrl = `https://${workerName}.${subdomain}.workers.dev`;
                console.log(`Derived WORKER_URL: ${workerUrl}`);
            }
        }
    }
}

if (!workerUrl) {
    console.error("Error: could not determine WORKER_URL.");
    console.error("Set it explicitly in .dev.vars or as a CI environment variable:");
    console.error("  WORKER_URL=https://telegram-bots.yoursubdomain.workers.dev");
    process.exit(1);
}

let allOk = true;
for (const bot of BOTS) {

    const webhookUrl = `${workerUrl}${bot.path}`;
    try {
        const res = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
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
