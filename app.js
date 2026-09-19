(() => {
  "use strict";

  const CFG = window.BIRD_RNBO_CONFIG;

  let audioContext = null;
  let device = null;
  let currentRecording = null;
  let currentAudioBuffer = null;

  const $ = (id) => document.getElementById(id);

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

  function logDiagnostic(message) {
    els.diagnostics.textContent += message + "\n";
  }

  function absoluteUrl(url) {
    if (!url) return "";
    return url.startsWith("//") ? "https:" + url : url;
  }

  function proxiedAudioUrl(url) {
    if (!CFG.AUDIO_PROXY) return url;
    return CFG.AUDIO_PROXY + encodeURIComponent(url);
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} — ${body.slice(0, 300)}`);
    }

    return response.json();
  }

  function buildXenoUrl(query, page, key) {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("page", String(page));

    if (key) params.set("key", key);

    return CFG.XENO_API_PROXY
      ? CFG.XENO_API_PROXY + "?" + params.toString()
      : CFG.XENO_API_URL + "?" + params.toString();
  }

  /*
   * We choose a random page first, then a random recording on that page.
   * If the page count is unknown or huge, we cap it.
   *
   * This does NOT download the recordings themselves. It only retrieves
   * JSON metadata. The actual audio is fetched only for the selected item.
   */
  async function randomRecording() {
    const key = window.prompt(
      "Clé API Xeno-canto (elle n'est pas enregistrée par cette page).\n\n" +
      "Si tu utilises un proxy, laisse vide."
    ) || "";

    const query = CFG.XENO_QUERY;
    setStatus("Recherche Xeno-canto…");

    const firstUrl = buildXenoUrl(query, 1, key);
    const first = await fetchJson(firstUrl);

    const numPages = Math.max(1, Number(first.numPages || 1));
    const maxPages = Math.min(numPages, CFG.RANDOM_MAX_PAGES);
    const page = 1 + Math.floor(Math.random() * maxPages);

    const data = page === 1
      ? first
      : await fetchJson(buildXenoUrl(query, page, key));

    if (!data.recordings || !data.recordings.length) {
      throw new Error("Aucun enregistrement trouvé pour cette requête.");
    }

    return data.recordings[
      Math.floor(Math.random() * data.recordings.length)
    ];
  }

  function renderRecording(rec) {
    currentRecording = rec;

    const scientific = [rec.gen, rec.sp, rec.ssp].filter(Boolean).join(" ");

    els.birdName.textContent =
      scientific || rec.en || "Bird recording";

    els.birdEnglish.textContent =
      rec.en ? rec.en : "";

    els.birdMeta.textContent =
      [
        rec.type,
        rec.cnt,
        rec.loc,
        rec.rec,
        rec.length,
        rec.q ? "quality " + rec.q : ""
      ].filter(Boolean).join(" · ");

    const pageUrl = absoluteUrl(
      rec.url || ("//xeno-canto.org/" + rec.id)
    );

    els.birdLink.href = pageUrl;
    els.birdLink.textContent = "Voir l'enregistrement Xeno-canto #" + rec.id;
  }

  async function fetchAndDecodeRecording(rec) {
    const rawUrl = absoluteUrl(rec.file);

    if (!rawUrl) {
      throw new Error("L'enregistrement ne fournit pas d'URL audio.");
    }

    const url = proxiedAudioUrl(rawUrl);
    logDiagnostic("Audio URL: " + url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Impossible de récupérer l'audio (${response.status}). ` +
        `Si le navigateur bloque CORS, utilise AUDIO_PROXY.`
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    // Decode MP3/M4A/etc. dans le navigateur.
    // Rien n'est écrit sur disque.
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  async function loadRecordingIntoRNBO(audioBuffer) {
    if (!device) throw new Error("RNBO n'est pas initialisé.");

    const descriptions = device.dataBufferDescriptions || [];

    if (!descriptions.length) {
      throw new Error(
        "Aucun DataBuffer exposé par ton export RNBO. " +
        "Ajoute un [buffer~ bird] dans le patch."
      );
    }

    let bufferId = CFG.RNBO_BUFFER_ID;

    if (!bufferId) {
      bufferId = descriptions[0].id;
    }

    const matching = descriptions.find(d => d.id === bufferId);

    if (!matching) {
      throw new Error(
        `DataBuffer "${bufferId}" introuvable. Buffers disponibles : ` +
        descriptions.map(d => d.id).join(", ")
      );
    }

    logDiagnostic(
      `RNBO DataBuffer: ${bufferId} | ` +
      `${audioBuffer.numberOfChannels} ch | ` +
      `${audioBuffer.sampleRate} Hz | ` +
      `${audioBuffer.length} samples`
    );

    /*
     * RNBO.js fournit directement setDataBuffer(id, AudioBuffer).
     * RNBO copie les données dans son propre buffer.
     */
    await device.setDataBuffer(bufferId, audioBuffer);

    return bufferId;
  }

  function parameterDisplayName(param) {
    return param.name || param.id;
  }

  function createParameterUI(param) {
    const wrapper = document.createElement("div");
    wrapper.className = "rnbo-param";

    const label = document.createElement("label");
    const title = document.createElement("span");
    const output = document.createElement("output");

    title.textContent = parameterDisplayName(param);
    output.textContent = formatValue(param.value);

    label.appendChild(title);
    label.appendChild(output);

    const input = document.createElement("input");
    input.type = "range";

    /*
     * RNBO Parameter fournit min/max/steps dans l'API exportée.
     * Les valeurs de secours rendent l'UI robuste aux exports différents.
     */
    input.min = Number.isFinite(param.min) ? param.min : 0;
    input.max = Number.isFinite(param.max) ? param.max : 1;
    input.step = Number.isFinite(param.steps) && param.steps > 0
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

  function formatValue(value) {
    if (typeof value !== "number") return String(value);
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function renderParameters() {
    els.params.innerHTML = "<h2>Paramètres RNBO</h2>";

    if (!device || !device.parameters) {
      els.params.insertAdjacentHTML(
        "beforeend",
        '<p class="muted">Aucun paramètre exposé.</p>'
      );
      return;
    }

    const parameters = Array.from(device.parameters);

    if (!parameters.length) {
      els.params.insertAdjacentHTML(
        "beforeend",
        '<p class="muted">Aucun paramètre exposé.</p>'
      );
      return;
    }

    parameters.forEach(param => {
      els.params.appendChild(createParameterUI(param));
    });
  }

  async function initRNBO() {
    setStatus("Chargement de RNBO…");

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const response = await fetch(CFG.RNBO_PATCH_URL);
    if (!response.ok) {
      throw new Error(
        `Impossible de charger ${CFG.RNBO_PATCH_URL} (${response.status}).`
      );
    }

    const patcher = await response.json();

    logDiagnostic(
      "RNBO patch chargé : " + CFG.RNBO_PATCH_URL
    );

    device = await RNBO.createDevice({
      context: audioContext,
      patcher
    });

    device.node.connect(audioContext.destination);

    const buffers = device.dataBufferDescriptions || [];
    logDiagnostic(
      "DataBuffers : " +
      (buffers.length
        ? buffers.map(b => b.id).join(", ")
        : "aucun")
    );

    renderParameters();

    els.start.disabled = false;
    els.random.disabled = false;

    setStatus("Prêt", "ok");
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
      setStatus("Recherche d'un oiseau…");

      if (audioContext.state !== "running") {
        await audioContext.resume();
      }

      const recording = await randomRecording();
      renderRecording(recording);

      setStatus("Téléchargement temporaire + décodage…");

      currentAudioBuffer = await fetchAndDecodeRecording(recording);

      setStatus("Chargement dans RNBO…");
      const bufferId = await loadRecordingIntoRNBO(currentAudioBuffer);

      /*
       * On envoie aussi un message "newbird" si ton patch possède un inport
       * du même nom. Ce n'est pas nécessaire au fonctionnement du buffer.
       */
      try {
        const message = RNBO.MessageEvent.fromObject({
          tag: "newbird",
          payload: [1]
        });
        device.scheduleEvent(message);
      } catch (_) {}

      setStatus(`Oiseau chargé — buffer ${bufferId}`, "ok");

    } catch (error) {
      console.error(error);
      setStatus("Erreur : " + error.message, "error");
      logDiagnostic("ERROR: " + error.stack);
    } finally {
      els.random.disabled = false;
    }
  }

  els.start.addEventListener("click", startAudio);
  els.random.addEventListener("click", newBird);

  els.slowdown.addEventListener("input", () => {
    const value = Number(els.slowdown.value);
    els.slowdownValue.textContent = value.toFixed(2) + "×";

    /*
     * IMPORTANT :
     * Ici on cherche un paramètre RNBO nommé "speed" ou "rate".
     * Si ton patch utilise un autre nom, change SPEED_PARAM_ID dans config.js
     * et ajoute-le à la configuration.
     */
    const speedParamId = CFG.SPEED_PARAM_ID;

    if (device && speedParamId) {
      const param = device.parametersById(speedParamId);
      if (param) param.value = value;
    }
  });

  window.addEventListener("error", event => {
    logDiagnostic(
      "Browser error: " +
      (event.error ? event.error.stack : event.message)
    );
  });

  initRNBO().catch(error => {
    console.error(error);
    setStatus("RNBO : " + error.message, "error");
    logDiagnostic(error.stack || error.message);
  });
})();
