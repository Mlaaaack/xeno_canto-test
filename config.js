window.BIRD_RNBO_CONFIG = {
  // Your actual RNBO export is included as patch.export.json.
  RNBO_PATCH_URL: "./patch.export.json",

  // Confirmed from the supplied RNBO export.
  RNBO_BUFFER_ID: "bird",
  SPEED_PARAM_ID: "speed",
  RNBO_VERSION: "1.2.6",

  // Xeno-canto API v3.
  XENO_API_URL: "https://xeno-canto.org/api/3/recordings",
  XENO_QUERY: "grp:birds type:song",

  // PUBLIC GITHUB PAGES:
  // Put your Cloudflare Worker URL here once deployed.
  // Example:
  // XENO_API_PROXY: "https://your-worker.workers.dev/api",
  // AUDIO_PROXY: "https://your-worker.workers.dev/audio?url="
  XENO_API_PROXY: "",
  AUDIO_PROXY: "",

  RANDOM_MAX_PAGES: 20
};
