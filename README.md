<p align="center">
    <img src="assets/icon.svg" width="128" height="128" alt="Skip Silence logo">
    <a href="https://chrome.google.com/webstore/detail/skip-silence/fhdmkhbefcbhakffdihhceaklaigdllh">
        <img src="img/chrome.png" alt="Available on chrome web store" width="150">
    </a>
    <a href="https://addons.mozilla.org/de/firefox/addon/skip-silence/">
        <img src="img/firefox.png" alt="Available on Firefox Addons" width="150">
    </a>
    <a href="https://microsoftedge.microsoft.com/addons/detail/skip-silence/njflliajflcedhfmpmhdekhmejekonmc">
        <img src="img/edge.png" alt="Available on Edge Add-ons" width="150">
    </a>
    <a href="https://www.buymeacoffee.com/vantezzen" target="_blank">
    <img src="assets/bmc.png" alt="Buy Me A Coffee" width="150">
    </a>
</p>

# ⚡ Skip Silence

> Welcome Skip Silence 6!
> Sorry for making you wait that long, but finally here is 

**Watch lectures, podcasts and videos faster — by skipping the parts where
nothing is said.**

Skip Silence watches the audio of whatever you're playing and speeds up
playback whenever it detects silence. The moment someone speaks again, it
snaps back to normal speed.

A 60-minute lecture with typical pauses plays in ~45 minutes. The extension
counts what it saves you.

## Features

- **Works everywhere HTML5 media plays** — YouTube, Twitch VODs,
  podcast players, university lecture portals, plain `<video>`/`<audio>` pages.
- **Two speeds, your choice** — set a speed for speech (e.g. 1×) and one for
  silence (e.g. 3×). Skip Silence switches between them automatically.
- **Follows subtitles** — when a subtitle or caption is on screen, playback
  returns to normal speed even if the audio is quiet, so whispered or soft
  dialogue isn't fast-forwarded. Works with native `<track>` subtitles and
  common player overlays (YouTube, video.js, JW Player, Plyr, Vimeo, …).
- **Silence stays silent** — optionally mute the leftover hiss and keyboard
  noise while fast-forwarding through quiet parts.
- **Smooth transitions** — a small audio lookahead lets Skip Silence unmute at
  exactly the moment speech returns, so soft first syllables and breaths
  aren't clipped.
- **Zero tuning needed** — the silence threshold adapts to each video's noise
  floor automatically. Prefer control? Switch to a manual threshold with a
  live volume meter.
- **Per-site settings** — different speeds for your lecture portal than for
  YouTube, or turn it off entirely on music sites.
- **Keyboard shortcut** — `Ctrl+Shift+S` toggles it anywhere.
- **Private by design** — everything runs locally in your browser. No
  accounts, no analytics, no data leaves your machine.

## Development

1. Build and load the extension:

   ```sh
   bun i
   bun run build        # Chrome → .output/chrome-mv3
   bun run build:firefox
   ```

   Load `.output/chrome-mv3` via `chrome://extensions` → "Load unpacked"
   (or the Firefox equivalent via `about:debugging`).

2. Play any video or podcast. The popup shows a live volume meter with the
   detection threshold — lime bars are speech, gray bars are silence being
   skipped.

3. Adjust the **Speech** and **Silence** speeds to taste. That's it.

## Good to know

- **DRM content** (Netflix, Spotify) can't be analyzed — browsers don't let
  extensions touch protected audio. The popup will tell you.
- **Live streams** are left alone: skipping ahead of a live edge only causes
  buffering.
- Some **cross-origin media** can't be analyzed safely; Skip Silence leaves it
  untouched rather than risk breaking its audio, and says so in the popup.

## Development

Built with [WXT](https://wxt.dev), React 19, Tailwind v4 and the Web Audio
API. `bun run dev` starts a browser with the extension loaded and hot reload.

Curious how real-time silence detection, the lookahead trick and the
per-site model work? Read [TECH.md](TECH.md).
