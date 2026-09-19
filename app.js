(() => {
  "use strict";

  const CFG = window.BIRD_RNBO_CONFIG;

  let audioContext = null;
  let device = null;
  let apiKey = "";
  let currentRecording = null;

  const $ = id => document.getElementById(id);

  const els = {
    start: $("startButton"),
    random: $("newBirdButton"),
    status: $("status"),
    birdName: $("birdName"),
    birdEnglish: $("birdEnglish"),
    birdMeta: $("birdMeta"),
    birdLink: $("birdLink"),
    slowdown: $("slowdown"),
    slowdownValue: $("slowdownValue"),
    params: $("params"),
    diagnostics: $("diagnostics")
  };

  function setStatus(message, kind = "") {
    els.status.textContent = message;
    els.status.className = "status " + kind;
  }

  function log(message) {
    els.diagnostics.textContent += message + "\n";
    console.log("[Bird Slow]", message);
  }

  function absoluteUrl(url) {
    if (!url) return "";
    return url.startsWith("//") ? "https:" + url : url;
  }

  function proxiedAudioUrl(rawUrl) {
    if (!CFG.AUDIO_PROXY) {
      const u = new URL(rawUrl);
      // Direct mode only: the API key is exposed to the browser/network.
      // For a public site, use AUDIO_PROXY instead.
      if (apiKey) u.searchParams.set("key", apiKey);
      return u.toString();
    }
    return CFG.AUDIO_PROXY + encodeURIComponent(rawUrl);
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Xeno-canto HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    return response.json();
  }

  function buildXenoUrl(query, page) {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("page", String(page));

    if (!CFG.XENO_API_PROXY && apiKey) {
      params.set("key", apiKey);
    }

    return CFG.XENO_API_PROXY
      ? CFG.XENO_API_PROXY + "?" + params.toString()
      : CFG.XENO_API_URL + "?" + params.toString();
  }

  async function getApiKeyIfNeeded() {
    if (CFG.XENO_API_PROXY) return "";

    const key = window.prompt(
      "Clé API Xeno-canto.\n\n" +
      "Pour un site public, utilise plutôt le Worker Cloudflare fourni dans le projet."
    );

    if (!key) {
      throw new Error("Aucune clé API Xeno-canto fournie.");
    }

    return key.trim();
  }

  async function randomRecording() {
    apiKey = await getApiKeyIfNeeded();

    const query = CFG.XENO_QUERY;
    setStatus("Recherche Xeno-canto…");

    const first = await fetchJson(buildXenoUrl(query, 1));
    const numPages = Math.max(1, Number(first.numPages || 1));
    const maxPages = Math.min(numPages, CFG.RANDOM_MAX_PAGES);
    const page = 1 + Math.floor(Math.random() * maxPages);

    const data = page === 1
      ? first
      : await fetchJson(buildXenoUrl(query, page));

    if (!Array.isArray(data.recordings) || !data.recordings.length) {
      throw new Error("Aucun enregistrement trouvé pour : " + query);
    }

    return data.recordings[
      Math.floor(Math.random() * data.recordings.length)
    ];
  }

  function renderRecording(rec) {
    currentRecording = rec;

    const scientific = [rec.gen, rec.sp, rec.ssp]
      .filter(Boolean)
      .join(" ");

    els.birdName.textContent = scientific || rec.en || "Bird recording";
    els.birdEnglish.textContent = rec.en || "";

    els.birdMeta.textContent = [
      rec.type,
      rec.cnt,
      rec.loc,
      rec.rec,
      rec.length,
      rec.q ? "quality " + rec.q : ""
    ].filter(Boolean).join(" · ");

    els.birdLink.href = absoluteUrl(
      rec.url || ("//xeno-canto.org/" + rec.id)
    );
    els.birdLink.textContent =
      "Voir l'enregistrement Xeno-canto #" + rec.id;

    log("Recording #" + rec.id);
    log("Audio source: " + absoluteUrl(rec.file));
  }

  async function fetchAndDecodeRecording(rec) {
    const rawUrl = absoluteUrl(rec.file);

    if (!rawUrl) {
      throw new Error("Xeno-canto n'a fourni aucune URL audio.");
    }

    const url = proxiedAudioUrl(rawUrl);
    log("Fetching audio: " + url);

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Téléchargement audio HTTP ${response.status}. ` +
        (body ? body.slice(0, 160) : "")
      );
    }

    const contentType = response.headers.get("content-type") || "";
    log("Audio Content-Type: " + contentType);

    const bytes = await response.arrayBuffer();
    log("Audio bytes: " + bytes.byteLength);

    if (!bytes.byteLength) {
      throw new Error("Le fichier audio téléchargé est vide.");
    }

    return audioContext.decodeAudioData(bytes);
  }

  async function loadRecordingIntoRNBO(audioBuffer) {
    if (!device) throw new Error("RNBO n'est pas initialisé.");

    const descriptions = device.dataBufferDescriptions || [];

    log(
      "DataBuffers: " +
      (descriptions.length
        ? descriptions.map(d => d.id).join(", ")
        : "aucun")
    );

    const bufferId = CFG.RNBO_BUFFER_ID || (
      descriptions[0] && descriptions[0].id
    );

    if (!bufferId) {
      throw new Error("Aucun DataBuffer RNBO disponible.");
    }

    const matching = descriptions.find(d => d.id === bufferId);

    if (!matching) {
      throw new Error(
        `DataBuffer "${bufferId}" introuvable. ` +
        `Disponibles: ${descriptions.map(d => d.id).join(", ")}`
      );
    }

    log(
      `setDataBuffer("${bufferId}") : ` +
      `${audioBuffer.numberOfChannels} ch, ` +
      `${audioBuffer.sampleRate} Hz, ` +
      `${audioBuffer.length} samples`
    );

    await device.setDataBuffer(bufferId, audioBuffer);

    return bufferId;
  }

  function formatValue(value) {
    if (typeof value !== "number") return String(value);
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function createParameterUI(param) {
    const wrapper = document.createElement("div");
    wrapper.className = "rnbo-param";

    const label = document.createElement("label");
    const title = document.createElement("span");
    const output = document.createElement("output");

    title.textContent = param.name || param.id;
    output.textContent = formatValue(param.value);

    label.appendChild(title);
    label.appendChild(output);

    const input = document.createElement("input");
    input.type = "range";
    input.min = Number.isFinite(param.min) ? param.min : 0;
    input.max = Number.isFinite(param.max) ? param.max : 1;
    input.step =
      Number.isFinite(param.steps) && param.steps > 0
        ? param.steps
        : "any";
    input.value = param.value;

    input.addEventListener("input", () => {
      const value = Number(input.value);
      param.value = value;
      output.textContent = formatValue(value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    return wrapper;
  }

  function renderParameters() {
    els.params.innerHTML = "<h2>Paramètres RNBO</h2>";

    if (!device || !device.parameters) {
      els.params.insertAdjacentHTML(
        "beforeend",
        '<p>Aucun paramètre exposé.</p>'
      );
      return;
    }

    const parameters = Array.from(device.parameters);

    if (!parameters.length) {
      els.params.insertAdjacentHTML(
        "beforeend",
        '<p>Aucun paramètre exposé.</p>'
      );
      return;
    }

    parameters.forEach(param => {
      els.params.appendChild(createParameterUI(param));
    });
  }

  function sendBang(tag) {
    if (!device) return;

    // A MessageEvent without a numeric/list payload represents a bang.
    const event = new RNBO.MessageEvent(RNBO.TimeNow, tag);
    device.scheduleEvent(event);
    log("Sent bang to RNBO inport: " + tag);
  }

  async function initRNBO() {
    audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();

    setStatus("Chargement de RNBO…");

    const response = await fetch(CFG.RNBO_PATCH_URL);
    if (!response.ok) {
      throw new Error(
        `Impossible de charger ${CFG.RNBO_PATCH_URL} (${response.status}).`
      );
    }

    const patcher = await response.json();

    log("RNBO patch chargé.");
    log("RNBO export version: " + CFG.RNBO_VERSION);

    device = await RNBO.createDevice({
      context: audioContext,
      patcher
    });

    device.node.connect(audioContext.destination);

    log(
      "RNBO.js version: " +
      (RNBO.version || "inconnue")
    );

    log(
      "Output channels: " +
      (device.node.numberOfOutputs || "?")
    );

    renderParameters();

    // Keep the exported parameter in sync with the UI.
    const speed = device.parametersById(CFG.SPEED_PARAM_ID);
    if (speed) {
      els.slowdown.value = speed.value;
      els.slowdownValue.textContent =
        formatValue(speed.value) + "×";
    }

    els.start.disabled = false;
    els.random.disabled = false;
    setStatus("RNBO prêt", "ok");
  }

  async function startAudio() {
    if (!audioContext) return;

    await audioContext.resume();

    els.start.textContent = "Audio actif";
    els.start.disabled = true;

    setStatus("Audio actif", "ok");
  }

  async function newBird() {
    try {
      els.random.disabled = true;

      if (audioContext.state !== "running") {
        await audioContext.resume();
      }

      const recording = await randomRecording();
      renderRecording(recording);

      setStatus("Téléchargement + décodage…");
      const audioBuffer = await fetchAndDecodeRecording(recording);

      setStatus("Copie dans RNBO…");
      const bufferId = await loadRecordingIntoRNBO(audioBuffer);

      // The supplied export declares an inport named "bang".
      // This is the important correction compared with the previous version.
      sendBang("bang");

      setStatus(`Oiseau chargé — buffer ${bufferId}`, "ok");
    } catch (error) {
      console.error(error);
      setStatus("Erreur : " + error.message, "error");
      log("ERROR: " + (error.stack || error.message));
    } finally {
      els.random.disabled = false;
    }
  }

  els.start.addEventListener("click", startAudio);
  els.random.addEventListener("click", newBird);

  els.slowdown.addEventListener("input", () => {
    const value = Number(els.slowdown.value);
    els.slowdownValue.textContent = value.toFixed(2) + "×";

    if (device) {
      const param = device.parametersById(CFG.SPEED_PARAM_ID);
      if (param) param.value = value;
    }
  });

  window.addEventListener("error", event => {
    log(
      "Browser error: " +
      (event.error ? event.error.stack : event.message)
    );
  });

  initRNBO().catch(error => {
    console.error(error);
    setStatus("RNBO : " + error.message, "error");
    log(error.stack || error.message);
  });
})();
