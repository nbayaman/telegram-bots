#!/usr/bin/env node
/**
 * Registers Telegram webhooks for every bot after local deployment.
 *
 * Reads secrets from process.env or local .dev.vars file.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const devVarsPath = resolve(__dirname, "../.dev.vars");

// Load .dev.vars when running locally
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
    // No .dev.vars
}

const BOTS = [
    { name: "WaMe", token: process.env.BOT_WAME_TOKEN, path: "/bot_wame" },
    { name: "NanaCalc", token: process.env.BOT_NANA_TOKEN, path: "/bot_nana" },
];

let workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");

if (!workerUrl) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (apiToken && accountId) {
        const toml = readFileSync(resolve(__dirname, "../wrangler.toml"), "utf8");
        const nameMatch = toml.match(/^name\s*=\s*"([^"]+)"/m);
        const workerName = nameMatch?.[1];

        if (workerName) {
            const subRes = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
                { headers: { Authorization: `Bearer ${apiToken}` } }
            );
            const subJson = await subRes.json();
            const subdomain = subJson.result?.subdomain;

            if (subdomain) {
                workerUrl = `https://${workerName}.${subdomain}.workers.dev`;
            }
        }
    }
}

if (!workerUrl) {
    console.log("Notice: WORKER_URL not provided. Skipping CLI webhook registration.");
    console.log("You can register webhooks anytime by visiting /setup_webhooks on your deployed worker URL.");
    process.exit(0);
}

let allOk = true;
for (const bot of BOTS) {
    if (!bot.token) {
        console.log(`Notice: ${bot.name} token not found in local environment. Skipping CLI webhook registration.`);
        continue;
    }

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
