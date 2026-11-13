/**
 * Detects whether a subtitle/caption is currently on screen for a media
 * element, so the controller can keep normal speed while someone is talking —
 * even when the audio itself is quiet (whispers, soft speech under the noise
 * floor, foreign-language scenes with subtitles, etc.).
 *
 * Two sources:
 * 1. Native `<track>` text tracks (`el.textTracks`) of kind subtitles/captions
 *    that are enabled ("showing", or "hidden" when a custom player renders
 *    them itself) — checked via `activeCues`.
 * 2. Caption overlays that players render into the DOM themselves (YouTube,
 *    video.js, JW Player, Plyr, Vimeo, …), searched for within the player
 *    container around the element.
 *
 * Results are cached for CHECK_INTERVAL_MS since the controller asks on every
 * ~21ms volume sample.
 */

const CHECK_INTERVAL_MS = 100;
/** How many ancestors up from the media element to look for caption overlays. */
const MAX_ANCESTOR_DEPTH = 6;

/** Caption overlay elements of common web players. */
const CAPTION_SELECTORS = [
  ".ytp-caption-segment", // YouTube
  ".vjs-text-track-display .vjs-text-track-cue", // video.js (Coursera, …)
  ".jw-captions .jw-text-track-cue", // JW Player
  ".plyr__caption", // Plyr
  ".vp-captions", // Vimeo
  ".shaka-text-container span", // Shaka Player
  ".mejs__captions-text", // MediaElement.js
  ".fp-captions", // Flowplayer
  '[data-purpose="captions-cue-text"]', // Udemy
  ".captions-text", // Dailymotion & generic
  ".caption-window", // generic
].join(",");

function hasText(text: string | null | undefined): boolean {
  return !!text && text.trim().length > 0;
}

function isVisible(node: Element): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.getClientRects().length === 0) return false;
  const style = getComputedStyle(node);
  return style.visibility !== "hidden" && style.opacity !== "0";
}

function hasActiveTrackCue(el: HTMLMediaElement): boolean {
  const tracks = el.textTracks;
  if (!tracks) return false;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.kind !== "subtitles" && track.kind !== "captions") continue;
    if (track.mode === "disabled") continue;
    const cues = track.activeCues;
    if (!cues) continue;
    for (let j = 0; j < cues.length; j++) {
      const cue = cues[j] as TextTrackCue & { text?: string };
      // VTTCue has .text; other cue types (e.g. DataCue) don't — count them.
      if (cue.text === undefined || hasText(cue.text)) return true;
    }
  }
  return false;
}

export class SubtitleWatcher {
  #el: HTMLMediaElement;
  #lastCheck = -Infinity;
  #lastResult = false;
  /** Player container where caption overlays were last found. */
  #root: Element | undefined;

  constructor(el: HTMLMediaElement) {
    this.#el = el;
  }

  /** Whether a subtitle is currently displayed for this element. */
  isActive(): boolean {
    const now = performance.now();
    if (now - this.#lastCheck < CHECK_INTERVAL_MS) return this.#lastResult;
    this.#lastCheck = now;
    this.#lastResult = hasActiveTrackCue(this.#el) || this.#hasDomCaption();
    return this.#lastResult;
  }

  #hasDomCaption(): boolean {
    if (this.#root?.isConnected) {
      const result = this.#checkRoot(this.#root);
      if (result !== undefined) return result;
    }
    this.#root = undefined;

    let node = this.#el.parentElement;
    for (let depth = 0; node && depth < MAX_ANCESTOR_DEPTH; depth++) {
      const result = this.#checkRoot(node);
      if (result !== undefined) {
        // Remember the player container; overlay nodes come and go, the
        // container stays.
        this.#root = node;
        return result;
      }
      node = node.parentElement;
    }
    return false;
  }

  /** undefined = no caption overlay elements in this subtree at all. */
  #checkRoot(root: Element): boolean | undefined {
    const nodes = root.querySelectorAll(CAPTION_SELECTORS);
    if (nodes.length === 0) return undefined;
    for (const node of nodes) {
      if (hasText(node.textContent) && isVisible(node)) return true;
    }
    return false;
  }
}
