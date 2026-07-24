import { Bot, webhookCallback } from "grammy";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const HELP_TEXT = "Send me a phone number and I'll reply with WhatsApp and Telegram links.";

function parseNumber(text) {
    let number = text.replace(/\D/g, "");
    // KG
    if (number.startsWith("0") && number.length === 10) {
        number = "996" + number.slice(1);
    }
    // KZ
    if (number.startsWith("8") && number.length === 11) {
        number = "7" + number.slice(1);
    }
    return number;
}

export async function handleWame(request, env) {
    try {
        const token = env?.BOT_WAME_TOKEN;
        if (!token) {
            return new Response("BOT_WAME_TOKEN is not configured in secrets", { status: 500 });
        }

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

        const cb = webhookCallback(bot, "cloudflare-mod");
        return await cb(request);
    } catch (err) {
        console.error("WaMe Error:", err);
        return new Response(`WaMe Error: ${err.message}`, { status: 500 });
    }
}
