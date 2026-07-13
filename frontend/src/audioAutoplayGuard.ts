const RECENT_AUTOPLAYS = new Map<string, number>();
let AUTOPLAY_SUPPRESSED_UNTIL = 0;
let ACTIVE_SUPPRESSION_COUNT = 0;

export function suppressPromptAutoplay(windowMs = 1800): void {
  AUTOPLAY_SUPPRESSED_UNTIL = Math.max(AUTOPLAY_SUPPRESSED_UNTIL, Date.now() + windowMs);
}

export function beginPromptAutoplaySuppression(windowMs = 1800): () => void {
  ACTIVE_SUPPRESSION_COUNT += 1;
  suppressPromptAutoplay(windowMs);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    ACTIVE_SUPPRESSION_COUNT = Math.max(0, ACTIVE_SUPPRESSION_COUNT - 1);
    if (ACTIVE_SUPPRESSION_COUNT === 0) {
      AUTOPLAY_SUPPRESSED_UNTIL = 0;
    }
  };
}

export function suppressPromptAutoplayForAudio(audio: HTMLAudioElement, fallbackWindowMs = 4000): void {
  const release = beginPromptAutoplaySuppression(fallbackWindowMs);
  const timeoutId = window.setTimeout(() => {
    finish();
  }, fallbackWindowMs);
  const finish = (): void => {
    window.clearTimeout(timeoutId);
    audio.removeEventListener("ended", finish);
    audio.removeEventListener("error", finish);
    audio.removeEventListener("abort", finish);
    release();
  };
  audio.addEventListener("ended", finish, { once: true });
  audio.addEventListener("error", finish, { once: true });
  audio.addEventListener("abort", finish, { once: true });
}

export function shouldAutoplayPrompt(key: string, windowMs = 1200): boolean {
  const now = Date.now();
  if (ACTIVE_SUPPRESSION_COUNT > 0) {
    return false;
  }
  if (now < AUTOPLAY_SUPPRESSED_UNTIL) {
    return false;
  }
  const previous = RECENT_AUTOPLAYS.get(key);
  if (previous !== undefined && now - previous < windowMs) {
    return false;
  }
  RECENT_AUTOPLAYS.set(key, now);
  return true;
}
