import { handleWame } from "./bots/wame.js";
import { handleNana } from "./bots/nana.js";
import { handleMediaTushur } from "./bots/mediatushur.js";

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (pathname === "/bot_wame") {
            return handleWame(request);
        }

        if (pathname === "/bot_nana") {
            return handleNana(request);
        }

        if (pathname === "/bot_mediatushur") {
            return handleMediaTushur(request);
        }

        return new Response("Not Found", { status: 404 });
    },
};
