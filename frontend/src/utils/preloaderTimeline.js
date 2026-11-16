// A single 1.4s timeline shared by the HTML-first and React-only splashes.
// If React mounts late, fade immediately but still give the visible artwork
// a short exit transition rather than flashing a second loader.
export const SPLASH_DURATION_MS = 1400;
export const SPLASH_FADE_MS = 250;

export function preloaderTimeline(startedAt, now) {
  const start = Number.isFinite(startedAt) && Number.isFinite(now) &&
    startedAt >= 0 && startedAt <= now ? startedAt : now;
  const elapsed = Math.max(0, now - start);
  const remaining = Math.max(0, SPLASH_DURATION_MS - elapsed);
  return {
    fadeInMs: Math.max(0, remaining - SPLASH_FADE_MS),
    removeInMs: Math.max(remaining, SPLASH_FADE_MS),
  };
}
