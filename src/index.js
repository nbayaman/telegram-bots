import { handleWame } from "./bots/wame.js";
import { handleNana } from "./bots/nana.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/bot_wame") {
      return handleWame(request, env.BOT_WAME_TOKEN);
    }

    if (pathname === "/bot_NanaCalc") {
      return handleNana(request, env.BOT_NANA_TOKEN);
    }

    return new Response("Not Found", { status: 404 });
  },
};
