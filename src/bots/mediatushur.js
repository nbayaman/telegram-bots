import { Bot, webhookCallback } from "grammy";

// Replace with the token BotFather gives you
export const TOKEN = "8748081545:AAEWrb-hIUK1RhJxVGPW7D8QznY62HcMujw";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const HELP_TEXT =
    "Send me a video link from YouTube, X (Twitter), or Facebook and I'll download it for you.\n\n" +
    "Supported:\n" +
    "• youtube.com / youtu.be\n" +
    "• x.com / twitter.com\n" +
    "• facebook.com / fb.watch";

const SUPPORTED_HOSTS = [
    "youtube.com",
    "youtu.be",
    "x.com",
    "twitter.com",
    "facebook.com",
    "fb.watch",
];

/**
 * Returns true if the text is a URL pointing to a supported platform.
 */
function isSupportedUrl(text) {
    let url;
    try {
        url = new URL(text.trim());
    } catch {
        return false;
    }
    const host = url.hostname.replace(/^www\./, "");
    return SUPPORTED_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/**
 * Ask Cobalt (https://cobalt.tools) for a direct video URL.
 * Cobalt is a free, open-source media downloader API — no key required.
 *
 * Possible success statuses:
 *   "redirect" — url is a direct link (use as-is)
 *   "tunnel"   — url is a Cobalt stream proxy (still usable)
 *
 * Throws on API errors or unsupported content.
 */
async function getCobaltUrl(inputUrl) {
    const res = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ url: inputUrl }),
    });

    if (!res.ok) {
        throw new Error(`Cobalt HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.status === "redirect" || data.status === "tunnel") {
        return data.url;
    }

    // Cobalt returns { status: "error", error: { code: "..." } }
    const code = data.error?.code ?? data.status ?? "unknown";
    throw new Error(`Cobalt error: ${code}`);
}

export async function handleMediaTushur(request) {
    const bot = new Bot(TOKEN, { botInfo });

    if (!botInfo) {
        await bot.init();
        botInfo = bot.botInfo;
    }

    bot.command("start", (ctx) => ctx.reply(HELP_TEXT));
    bot.command("help", (ctx) => ctx.reply(HELP_TEXT));

    bot.on("message:text", async (ctx) => {
        const text = ctx.message.text.trim();

        if (!isSupportedUrl(text)) {
            await ctx.reply(
                "Please send a valid link from YouTube, X, or Facebook.\n\n/help for more info."
            );
            return;
        }

        await ctx.reply("Fetching video…");

        let videoUrl;
        try {
            videoUrl = await getCobaltUrl(text);
        } catch (err) {
            console.error("Cobalt error:", err);
            await ctx.reply(
                "Sorry, I couldn't fetch that video. The link may be private, age-restricted, or unsupported."
            );
            return;
        }

        // Try sending the video directly in Telegram.
        // Falls back to a raw download link for large files or unsupported formats.
        try {
            await ctx.replyWithVideo(videoUrl);
        } catch {
            await ctx.reply(`Here's your download link:\n${videoUrl}`);
        }
    });

    return webhookCallback(bot, "cloudflare-mod")(request);
}
