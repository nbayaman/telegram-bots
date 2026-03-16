import { Bot, webhookCallback } from "grammy";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const HELP_TEXT = "Send me a phone number and I'll reply with WhatsApp and Telegram links.";

/**
 * Normalise a raw string to a phone number:
 * - strip all non-digit characters
 * - if the result starts with '0', replace the leading 0 with Kyrgyzstan's
 *   country code 996 (matching the original Python bot behaviour)
 */
function parseNumber(text) {
    let number = text.replace(/\D/g, "");
    if (number.startsWith("0")) {
        number = "996" + number.slice(1);
    }
    return number;
}

export async function handleWame(request, token) {
    const bot = new Bot(token, { botInfo });

    if (!botInfo) {
        await bot.init();
        botInfo = bot.botInfo;
    }

    bot.command("start", (ctx) => ctx.reply(HELP_TEXT));
    bot.command("help", (ctx) => ctx.reply(HELP_TEXT));

    bot.on("message:text", async (ctx) => {
        const number = parseNumber(ctx.message.text);
        if (!number) {
            await ctx.reply("That is not a number");
            return;
        }
        await ctx.reply(`https://wa.me/${number}`);
        await ctx.reply(`https://t.me/+${number}`);
    });

    return webhookCallback(bot, "cloudflare-mod")(request);
}
