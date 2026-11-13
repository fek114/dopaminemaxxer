# Skip Silence — Technical Documentation

How the extension works under the hood. For the general overview, see
[README.md](README.md).

## Architecture

There are three moving parts — content script, popup, and a background script
that only exists for the keyboard shortcut. Settings flow through
`chrome.storage`; live data flows through a runtime Port. There is no server,
no offscreen document, and no page-world script injection.

- `entrypoints/content.ts` — runs on every page (`all_frames`). Capture-phase
  `play`/`pause`/`ended`/`emptied` listeners on `document` catch every media
  element, including dynamically added ones — media events don't bubble but do
  capture, so no MutationObserver is needed. Resolves per-site setting
  overrides by top-level hostname (via `location.ancestorOrigins`; Firefox
  iframes fall back to their own hostname) and serves the popup's live meter
  over a runtime Port at ~30Hz.
- `entrypoints/volume-processor.ts` — AudioWorklet processor: passes audio
  through untouched and posts one RMS value per 1024-sample window (~21ms at
  48kHz) from the audio thread, so detection is immune to background-tab timer
  throttling.
- `lib/detector.ts` — per-element audio graph and threshold logic.
- `lib/subtitles.ts` — detects on-screen subtitles/captions per element.
- `lib/controller.ts` — per-element playback policy (when to speed up, mute,
  and restore).
- `lib/speed.ts` — sets `playbackRate` and defends it against sites (YouTube)
  whose `ratechange` handlers revert external rate changes, using a
  capture-phase listener + `stopImmediatePropagation` + retry.
- `entrypoints/background.ts` — listens for the `Ctrl+Shift+S` command and
  flips the enabled flag (per-site aware).
- `entrypoints/popup/` + `components/` — React popup (Tailwind v4 +
  shadcn/ui): live canvas volume meter with threshold line, speed cards,
  toggles, per-site override switch.

## Audio graph & silence detection

```
MediaElementSource → VolumeProcessor (worklet) → DelayNode → GainNode → destination
                          │
                          └─ RMS per ~21ms window → threshold logic → controller
```

- `createMediaElementSource()` permanently reroutes an element's audio and can
  only ever be called once per element — the graph is cached per element in a
  WeakMap.
- Volume is RMS converted to dBFS. The **dynamic threshold** takes the
  15th-percentile noise floor of the last ~10s of finite samples, adds 3dB,
  and clamps to −60..−20 dBFS. A **Schmitt trigger** adds 3dB of hysteresis:
  silence starts below the threshold but only ends 3dB above it, so borderline
  noise doesn't flicker the state.
- Detection taps the audio **before** the DelayNode. With lookahead enabled
  the delay is 60ms, which means we know about every transition 60ms before
  the user hears it.

## Playback policy

- Silence must hold **500ms** before speeding up (prevents rapid skip/unskip
  flapping), then the rate ramps linearly to the silence speed over ~200ms.
- On sound, the rate snaps back immediately — anything else eats speech.
- **Follow subtitles** (`lib/subtitles.ts`): a silent sample counts as speech
  while a subtitle is on screen. Sources: active cues of enabled
  (`showing`/`hidden`) subtitle/caption `textTracks`, plus visible, non-empty
  caption overlays of common players (YouTube `.ytp-caption-segment`,
  video.js, JW Player, Plyr, Vimeo, Shaka, …) searched within up to 6
  ancestors of the media element. Checked at most every 100ms; the player
  container is cached. When the subtitle disappears the normal 500ms hold
  applies before speeding up again.
- Muting uses gain ramps (`setTargetAtTime`, 15ms mute / 40ms unmute time
  constants) to avoid clicks.
- **Lookahead** ("Smooth transitions"): the 60ms output delay sits well under
  the ~125ms audio-lag detectability threshold for lip sync (ITU-R BT.1359)
  while still covering detection latency (~21ms) plus the scheduled unmute.
  On silence end, the unmute is scheduled on the AudioContext clock to
  complete exactly as the speech onset reaches the ears, starting 40ms early
  so breaths and soft first syllables survive — a real margin-before, served
  from the delay buffer. The delay collapses to 0 whenever lookahead or
  muting is off, so there's never pointless lip lag.

## Why element capture (and not tabCapture)

The original Skip Silence used `chrome.tabCapture` on Chrome; that API is
unavailable to MV3 extensions. Element capture is the only viable MV3 path,
and it comes with known constraints handled in `content.ts`:

- **Cross-origin media without CORS headers**: `createMediaElementSource()`
  on such elements outputs pure silence and permanently kills the element's
  audio. We check `currentSrc` origin before attaching and refuse, surfacing
  "can't analyze" in the popup. Undetectable residual: same-origin URLs that
  *redirect* cross-origin.
- **DRM media** (`el.mediaKeys != null`, e.g. Netflix): skipped.
- **Live streams** (`duration === Infinity`): skipped — speeding up the live
  edge only causes stalls.
- **Shadow-DOM players**: not detected (`play` is `composed: false`).

## Settings & state

- One `Settings` object in `chrome.storage.sync` (single write per change,
  sliders commit on release to respect sync write quotas).
- Per-site overrides in `chrome.storage.local` as
  `Record<hostname, Settings>` — an override fully replaces the global
  settings on that site. Keyed by top-level hostname so embedded players
  follow the embedding site.
- `withDefaults()` merges stored objects with `DEFAULT_SETTINGS` so fields
  added in updates get their defaults.
- Time saved accumulates in `storage.local`, flushed every ~5s
  (read-modify-write; a lost tick across tabs is acceptable).

## Misc hard-won details

- The shared AudioContext is **never suspended** — audio of a still-playing
  element routes through it even when detection is stopped, and suspending
  would mute it.
- If autoplay policy keeps the context suspended, we retry `resume()` on the
  next user gesture — otherwise rerouted media would stay silent.
- The Chromium <128 A/V-desync workaround from the old extension
  ("keep audio in sync") was deliberately dropped: the underlying bug is
  fixed, and the workaround caused periodic stutters.
- The old "set 1.01 instead of 1.0 to avoid clicks" hack is currently not
  applied; re-add in `lib/speed.ts` if clicking at exactly 1.0 reappears.

## Development

```sh
bun i
bun run dev            # Chrome with the extension loaded
bun run build          # .output/chrome-mv3
bun run build:firefox  # .output/firefox-mv2
bun run compile        # typecheck
```

Manual smoke test: serve `test/media-test.html` same-origin, hit
"Generate & play" — the rate readout should jump to the silence speed during
the 3s silence gaps and snap back for each tone.

Manual test matrix: YouTube lecture (skips in pauses, snaps back on speech,
survives YouTube's own rate handling), Twitch VOD, plain `<audio>` podcast
page, cross-origin `<video>` (audio stays intact, popup shows "can't
analyze"), Netflix (untouched, DRM status), disable mid-silence (rate and
volume restore), Firefox spot-check.
