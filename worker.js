/*
 * Cloudflare Worker for Bird Slow
 *
 * Store the Xeno-canto API key as a Worker secret:
 *
 *   XENO_API_KEY
 *
 * Routes:
 *   /api?query=grp%3Abirds%20type%3Asong&page=1
 *   /audio?url=https%3A%2F%2Fxeno-canto.org%2F...
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function responseWithCors(body, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(body, { ...init, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return responseWithCors("");
    }

    if (url.pathname === "/api") {
      const query = url.searchParams.get("query");
      const page = url.searchParams.get("page") || "1";

      if (!query) {
        return responseWithCors("Missing query", { status: 400 });
      }

      if (!env.XENO_API_KEY) {
        return responseWithCors(
          "XENO_API_KEY is not configured on the Worker",
          { status: 500 }
        );
      }

      const target = new URL(
        "https://xeno-canto.org/api/3/recordings"
      );

      target.searchParams.set("query", query);
      target.searchParams.set("page", page);
      target.searchParams.set("key", env.XENO_API_KEY);

      const response = await fetch(target.toString());

      return responseWithCors(response.body, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ||
            "application/json"
        }
      });
    }

    if (url.pathname === "/audio") {
      const audioUrl = url.searchParams.get("url");

      if (!audioUrl) {
        return responseWithCors("Missing url", { status: 400 });
      }

      let target;
      try {
        target = new URL(audioUrl);
      } catch (_) {
        return responseWithCors("Invalid url", { status: 400 });
      }

      // Only allow Xeno-canto audio hosts.
      if (
        target.hostname !== "xeno-canto.org" &&
        target.hostname !== "www.xeno-canto.org"
      ) {
        return responseWithCors("Host not allowed", { status: 403 });
      }

      if (!env.XENO_API_KEY) {
        return responseWithCors(
          "XENO_API_KEY is not configured on the Worker",
          { status: 500 }
        );
      }

      // Xeno-canto requires the API key for recording downloads.
      target.searchParams.set("key", env.XENO_API_KEY);

      const response = await fetch(target.toString());

      return responseWithCors(response.body, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ||
            "audio/mpeg"
        }
      });
    }

    return responseWithCors(
      "Bird Slow proxy. Use /api or /audio."
    );
  }
};
