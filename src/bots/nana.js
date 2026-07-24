import { Bot, webhookCallback } from "grammy";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const FALLBACK_CNY_RATE = 0.14; // approx 1 CNY = 0.14 USD

async function getCnyRate() {
    try {
        const res = await fetch("https://www.nbkr.kg/XML/weekly.xml");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();

        const cnyMatch = xml.match(
            /<Currency\s+ISOCode="CNY"[^>]*>[\s\S]*?<Value>([\d,. ]+)<\/Value>/
        );
        if (!cnyMatch) throw new Error("CNY not found in XML");

        const rate = parseFloat(cnyMatch[1].replace(",", "."));
        if (isNaN(rate)) throw new Error("Could not parse CNY rate");
        return rate;
    } catch (err) {
        console.error("Failed to fetch CNY rate:", err);
        return FALLBACK_CNY_RATE;
    }
}

function formatPrice(value) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function parsePrice(text) {
    const match = text.match(/[\d]+(?:[.,\s][\d]+)*/);
    if (!match) return null;
    const cleaned = match[0].replace(/[\s,]/g, "").replace(",", ".");
    const value = parseFloat(cleaned.replace(",", "."));
    return isNaN(value) ? null : value;
}

async function replyWithPrices(ctx, price) {
    const rate = await getCnyRate();
    const priceUsd = price * rate;
    const finalPrice = priceUsd * 1.5; // 50% markup

    await ctx.reply(`<b>Price in CNY:</b> ${formatPrice(price)} ¥`, { parse_mode: "HTML" });
    await ctx.reply(`<b>CNY to USD rate:</b> ${formatPrice(rate)} USD`, { parse_mode: "HTML" });
    await ctx.reply(`<b>Price in USD:</b> ${formatPrice(priceUsd)} USD`, { parse_mode: "HTML" });
    await ctx.reply(`<b>Final price with 50% markup:</b> ${formatPrice(finalPrice)} USD`, { parse_mode: "HTML" });
}

export async function handleNana(request, env) {
    try {
        const token = env?.BOT_NANA_TOKEN;
        if (!token) {
            return new Response("BOT_NANA_TOKEN is not configured in secrets", { status: 500 });
        }
        const bot = new Bot(token, { botInfo });

        if (!botInfo) {
            await bot.init();
            botInfo = bot.botInfo;
        }

        bot.command("start", (ctx) => ctx.reply("Please enter a price in yuans."));
        bot.command("help", (ctx) => ctx.reply("Send me a price in Chinese yuan (¥) and I'll calculate the final price in USD with a 50% markup."));

        bot.on("message:text", async (ctx) => {
            const price = parsePrice(ctx.message.text);
            if (price === null) {
                await ctx.reply("Please enter a price in yuans.");
                return;
            }
            await replyWithPrices(ctx, price);
        });

        const cb = webhookCallback(bot, "cloudflare-mod");
        return await cb(request);
    } catch (err) {
        console.error("NanaCalc Error:", err);
        return new Response(`NanaCalc Error: ${err.message}`, { status: 500 });
    }
}
