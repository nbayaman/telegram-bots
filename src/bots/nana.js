import { Bot, webhookCallback } from "grammy";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const FALLBACK_CNY_RATE = 0.14; // approx 1 CNY = 0.14 USD

/**
 * Fetch the current CNY→KGS rate from the National Bank of Kyrgyzstan and
 * convert it to USD using a fixed KGS/USD rate embedded in the XML response.
 *
 * The XML endpoint returns exchange rates relative to KGS. grammy runs in a
 * fetch-capable environment so standard fetch() is available.
 */
async function getCnyRate() {
    try {
        const res = await fetch("https://www.nbkr.kg/XML/weekly.xml");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();

        // Extract the Value for CNY using a simple regex (no DOM parser in Workers)
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

/**
 * Format a number for display: up to 2 decimal places, thousands separator.
 * e.g. 1234.5 → "1,234.5"
 */
function formatPrice(value) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * Try to extract a numeric price from the user's message.
 * Supports formats like: 199, 199.9, 1 999, 1,999.5
 */
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

export async function handleNana(request, token) {
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

    return webhookCallback(bot, "cloudflare-mod")(request);
}
