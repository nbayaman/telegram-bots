import { handleWame } from "./bots/wame.js";
import { handleNana } from "./bots/nana.js";

async function getBotStatus(name, token, path, origin) {
    if (!token) {
        return `[${name}] ✗ Secret TOKEN missing from Cloudflare Workers`;
    }

    try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meData = await meRes.json();
        if (!meData.ok) {
            return `[${name}] ✗ Invalid Telegram Token: ${meData.description}`;
        }
        const botUsername = meData.result.username;

        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const infoData = await infoRes.json();
        const info = infoData.result || {};

        const expectedUrl = `${origin}${path}`;
        const isUrlMatching = info.url === expectedUrl;

        let statusText = `[${name} (@${botUsername})]\n`;
        statusText += `  • Registered Webhook URL: ${info.url || "(NONE SET)"}\n`;
        statusText += `  • Expected Webhook URL:   ${expectedUrl}\n`;
        statusText += `  • Webhook Status: ${isUrlMatching ? "✓ CORRECT" : "✗ MISMATCH OR MISSING"}\n`;
        statusText += `  • Pending Updates: ${info.pending_update_count ?? 0}\n`;
        if (info.last_error_message) {
            const errDate = info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : "N/A";
            statusText += `  • Last Telegram Error (${errDate}): ${info.last_error_message}\n`;
        }

        return statusText;
    } catch (err) {
        return `[${name}] Error checking status: ${err.message}`;
    }
}

export default {
    async fetch(request, env) {
        const { pathname, origin } = new URL(request.url);

        if (pathname === "/setup_webhooks") {
            const results = [];

            if (env.BOT_WAME_TOKEN) {
                const wameUrl = `${origin}/bot_wame`;
                const res = await fetch(
                    `https://api.telegram.org/bot${env.BOT_WAME_TOKEN}/setWebhook?url=${encodeURIComponent(wameUrl)}`
                );
                const data = await res.json();
                results.push(`WaMe (${wameUrl}): ${data.ok ? "✓ SUCCESS" : "✗ FAILED: " + data.description}`);
            } else {
                results.push("WaMe: BOT_WAME_TOKEN is missing from Cloudflare Worker secrets");
            }

            if (env.BOT_NANA_TOKEN) {
                const nanaUrl = `${origin}/bot_nana`;
                const res = await fetch(
                    `https://api.telegram.org/bot${env.BOT_NANA_TOKEN}/setWebhook?url=${encodeURIComponent(nanaUrl)}`
                );
                const data = await res.json();
                results.push(`NanaCalc (${nanaUrl}): ${data.ok ? "✓ SUCCESS" : "✗ FAILED: " + data.description}`);
            } else {
                results.push("NanaCalc: BOT_NANA_TOKEN is missing from Cloudflare Worker secrets");
            }

            return new Response(results.join("\n"), {
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        if (pathname === "/status") {
            const wameStatus = await getBotStatus("WaMe", env.BOT_WAME_TOKEN, "/bot_wame", origin);
            const nanaStatus = await getBotStatus("NanaCalc", env.BOT_NANA_TOKEN, "/bot_nana", origin);
            return new Response(`${wameStatus}\n\n${nanaStatus}`, {
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        if (pathname === "/bot_wame") {
            return handleWame(request, env);
        }

        if (pathname === "/bot_nana") {
            return handleNana(request, env);
        }

        return new Response("Telegram Bots Worker is Running.\nVisit /status to check bot status or /setup_webhooks to set webhooks.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    },
};
