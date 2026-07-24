import { handleWame } from "./bots/wame.js";
import { handleNana } from "./bots/nana.js";

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

        if (pathname === "/bot_wame") {
            return handleWame(request, env);
        }

        if (pathname === "/bot_nana") {
            return handleNana(request, env);
        }

        return new Response("Not Found", { status: 404 });
    },
};
