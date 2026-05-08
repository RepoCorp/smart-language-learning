const RECENT_AUTOPLAYS = new Map<string, number>();

export function shouldAutoplayPrompt(key: string, windowMs = 1200): boolean {
  const now = Date.now();
  const previous = RECENT_AUTOPLAYS.get(key);
  if (previous !== undefined && now - previous < windowMs) {
    return false;
  }
  RECENT_AUTOPLAYS.set(key, now);
  return true;
}

