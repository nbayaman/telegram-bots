import { Bot, webhookCallback } from "grammy";

export const TOKEN = "8748081545:AAEWrb-hIUK1RhJxVGPW7D8QznY62HcMujw";
const RAPIDAPI_KEY = "3918f4eb49msh33525a8c0436cd9p162b31jsn919834e1c771";

// Cache botInfo at module level to avoid a getMe call on every warm request
let botInfo = undefined;

const HELP_TEXT =
    "Send me a video link and I'll download it for you.\n\n" +
    "Supported:\n" +
    "• youtube.com / youtu.be\n" +
    "• x.com / twitter.com\n" +
    "• facebook.com / fb.watch";

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(text) {
    let url;
    try {
        url = new URL(text.trim());
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return { platform: "youtube", url };
    if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com")) return { platform: "twitter", url };
    if (host === "facebook.com" || host === "fb.watch" || host.endsWith(".facebook.com")) return { platform: "facebook", url };
    return null;
}

// ---------------------------------------------------------------------------
// YouTube — YT-API on RapidAPI
// Returns the best combined-audio+video MP4 URL (360p, immediately playable).
// Store your key: npx wrangler secret put BOT_MEDIATUSHUR_RAPIDAPI_KEY
// ---------------------------------------------------------------------------

async function getYouTubeUrl(pageUrl, rapidApiKey) {
    // Extract video ID from youtube.com/watch?v=ID or youtu.be/ID
    let videoId;
    const u = new URL(pageUrl);
    if (u.hostname === "youtu.be" || u.hostname.endsWith(".youtu.be")) {
        videoId = u.pathname.slice(1).split("/")[0];
    } else {
        videoId = u.searchParams.get("v");
    }
    if (!videoId) throw new Error("Could not extract YouTube video ID");

    const res = await fetch(`https://yt-api.p.rapidapi.com/dl?id=${encodeURIComponent(videoId)}`, {
        headers: {
            "x-rapidapi-host": "yt-api.p.rapidapi.com",
            "x-rapidapi-key": rapidApiKey,
        },
    });
    if (!res.ok) throw new Error(`YT-API HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== "OK") throw new Error(`YT-API status: ${data.status}`);

    // `formats` contains combined audio+video streams — take the first (360p MP4)
    const videoUrl = data.formats?.[0]?.url;
    if (!videoUrl) throw new Error("No video formats returned");
    return videoUrl;
}

// ---------------------------------------------------------------------------
// X / Twitter — fxtwitter.com (free, no key required)
// Returns the highest-quality video URL from the tweet's media.
// ---------------------------------------------------------------------------

async function getTwitterUrl(pageUrl) {
    const match = pageUrl.match(/\/status\/(\d+)/);
    if (!match) throw new Error("Could not extract tweet ID");
    const tweetId = match[1];

    // Twitter's public syndication API — no auth required
    const res = await fetch(
        `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`
    );
    if (!res.ok) throw new Error(`Twitter syndication HTTP ${res.status}`);

    const data = await res.json();

    // Pick the highest-bitrate MP4 variant
    const variants = data.video?.variants ?? [];
    const mp4s = variants.filter((v) => v.type === "video/mp4");
    if (!mp4s.length) throw new Error("No video found in this tweet");

    // Variants are returned in ascending bitrate order — last is highest quality
    const videoUrl = mp4s[mp4s.length - 1].src;
    return videoUrl;
}

// ---------------------------------------------------------------------------
// Facebook — requires a RapidAPI subscription to a Facebook downloader.
// Stub: tells the user to subscribe and which API to use.
// ---------------------------------------------------------------------------

async function getFacebookUrl(pageUrl, rapidApiKey) {
    // Using: facebook-reel-and-video-downloader.p.rapidapi.com
    // Subscribe at: https://rapidapi.com/erenalpaslan/api/facebook-reel-and-video-downloader
    const res = await fetch(
        `https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(pageUrl)}`,
        {
            headers: {
                "x-rapidapi-host": "facebook-reel-and-video-downloader.p.rapidapi.com",
                "x-rapidapi-key": rapidApiKey,
            },
        }
    );
    if (!res.ok) throw new Error(`FB API HTTP ${res.status}`);

    const data = await res.json();
    // Response: { success: true, links: [ { resolution: "HD", link: "..." }, ... ] }
    const hdLink = data.links?.find((l) => l.resolution === "HD")?.link
        ?? data.links?.[0]?.link;
    if (!hdLink) throw new Error("No video link in Facebook API response");
    return hdLink;
}

// ---------------------------------------------------------------------------
// Bot handler
// ---------------------------------------------------------------------------

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
        const detected = detectPlatform(text);

        if (!detected) {
            await ctx.reply("Please send a valid link from YouTube, X, or Facebook.\n\n/help for more info.");
            return;
        }

        await ctx.reply("Fetching video…");

        let videoUrl;
        try {
            if (detected.platform === "youtube") {
                videoUrl = await getYouTubeUrl(text, RAPIDAPI_KEY);
            } else if (detected.platform === "twitter") {
                videoUrl = await getTwitterUrl(text);
            } else if (detected.platform === "facebook") {
                videoUrl = await getFacebookUrl(text, RAPIDAPI_KEY);
            }
        } catch (err) {
            console.error(`[${detected.platform}] error:`, err.message);
            await ctx.reply(`Error [${detected.platform}]: ${err.message}`);
            return;
        }

        // Twitter (twimg.com) is a public CDN — Telegram can stream it directly.
        // YouTube and Facebook URLs are IP-bound/auth-bound, so we send a download link.
        if (detected.platform === "twitter") {
            try {
                await ctx.replyWithVideo(videoUrl);
            } catch {
                await ctx.reply(`<a href="${videoUrl}">Download link</a>`, { parse_mode: "HTML" });
            }
        } else {
            await ctx.reply(`<a href="${videoUrl}">Download link</a>`, { parse_mode: "HTML" });
        }
    });

    return webhookCallback(bot, "cloudflare-mod")(request);
}
