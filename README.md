# Bird Slow — corrected project

This project contains the supplied RNBO export and a corrected GitHub Pages implementation.

## What I found in the RNBO export

The supplied export is RNBO 1.2.6 and exposes:

- parameter `speed`: 0 → 2, initial value 0.3
- external DataRef `bird` of type `Float32Buffer`
- one event input tagged `bang`
- two audio outputs

So the web code uses:

- `RNBO_BUFFER_ID = "bird"`
- `SPEED_PARAM_ID = "speed"`
- RNBO.js 1.2.6
- a `bang` sent to the RNBO inport after the bird is copied into the buffer

## Important fixes

The previous project had two important problems:

1. It loaded RNBO with `rnbo/latest` although the export is RNBO 1.2.6.
   The new project loads `rnbo/1.2.6`.

2. It sent an event tagged `newbird`, but the supplied export exposes an inport tagged `bang`.
   The new project sends a bang to `bang` after `setDataBuffer()`.

There is also an important Xeno-canto change: recording downloads require an API key. The Cloudflare Worker therefore adds the secret API key to the `/audio` request as well as to the API metadata request.

## GitHub Pages + Cloudflare Worker

For a public website, do NOT put your Xeno-canto API key in GitHub.

1. Deploy `worker.js` as a Cloudflare Worker.
2. Add a Worker secret named:

`XENO_API_KEY`

3. Copy the Worker URL.
4. Edit `config.js`:

```js
XENO_API_PROXY: "https://YOUR-WORKER.workers.dev/api",
AUDIO_PROXY: "https://YOUR-WORKER.workers.dev/audio?url=",
```

5. Push the whole folder to GitHub Pages.

## Direct testing

If `XENO_API_PROXY` and `AUDIO_PROXY` are empty, the page asks for the Xeno-canto API key.

This is useful for debugging but is NOT appropriate for a public site because the key is exposed to the browser.

## Security

The API key that was previously pasted into the chat should be considered exposed. Revoke/regenerate it before deploying the public version, then store the new key only as the Cloudflare Worker secret.

## Audio flow

Xeno-canto metadata
→ random recording
→ audio URL
→ Cloudflare Worker
→ ArrayBuffer
→ Web Audio `decodeAudioData`
→ RNBO `setDataBuffer("bird", audioBuffer)`
→ RNBO `bang` inport
→ your existing RNBO playback/slowdown patch
