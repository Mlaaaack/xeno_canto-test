/*
 * OPTIONAL CLOUDFLARE WORKER
 *
 * GitHub Pages is static, so it cannot safely hide a Xeno-canto API key.
 * If you want a public site, deploy this Worker and store your Xeno-canto
 * key as a Worker secret named XENO_API_KEY.
 *
 * Routes:
 *   /api?query=grp%3Abirds%20type%3Asong&page=1
 *   /audio?url=https%3A%2F%2Fxeno-canto.org%2F...
 *
 * Then set in config.js:
 *
 *   XENO_API_PROXY: "https://YOUR-WORKER.workers.dev/api"
 *   AUDIO_PROXY: "https://YOUR-WORKER.workers.dev/audio?url="
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response("", { headers: cors });
    }

    if (url.pathname === "/api") {
      const query = url.searchParams.get("query");
      const page = url.searchParams.get("page") || "1";

      if (!query) {
        return new Response("Missing query", {
          status: 400,
          headers: cors
        });
      }

      const target = new URL(
        "https://xeno-canto.org/api/3/recordings"
      );

      target.searchParams.set("query", query);
      target.searchParams.set("page", page);
      target.searchParams.set("key", env.XENO_API_KEY);

      const response = await fetch(target.toString());

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...cors,
          "Content-Type":
            response.headers.get("Content-Type") ||
            "application/json"
        }
      });
    }

    if (url.pathname === "/audio") {
      const audioUrl = url.searchParams.get("url");

      if (!audioUrl) {
        return new Response("Missing url", {
          status: 400,
          headers: cors
        });
      }

      const target = new URL(audioUrl);

      // Security: only allow Xeno-canto hosts.
      if (
        target.hostname !== "xeno-canto.org" &&
        target.hostname !== "www.xeno-canto.org"
      ) {
        return new Response("Host not allowed", {
          status: 403,
          headers: cors
        });
      }

      const response = await fetch(target.toString());

      const headers = new Headers(cors);
      headers.set(
        "Content-Type",
        response.headers.get("Content-Type") || "audio/mpeg"
      );

      return new Response(response.body, {
        status: response.status,
        headers
      });
    }

    return new Response(
      "Bird Slow proxy. Use /api or /audio.",
      { headers: cors }
    );
  }
};
