import { deterministicSort } from "../deterministic";

const LETTER_RUN_PATTERN = /([A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+)/g;

export type WordPartToken = {
  id: string;
  text: string;
  originalIndex: number;
};

export type WordPartUnit =
  | {
      type: "token";
      token: WordPartToken;
    }
  | {
      type: "separator";
      text: string;
    };

function chunkSizeForRemaining(remaining: number): number {
  if (remaining <= 3) {
    return remaining;
  }
  if (remaining === 4 || remaining === 5 || remaining === 7) {
    return 2;
  }
  return 3;
}

function splitLetterRun(value: string): string[] {
  const chunks: string[] = [];
  let index = 0;
  while (index < value.length) {
    const remaining = value.length - index;
    const size = chunkSizeForRemaining(remaining);
    chunks.push(value.slice(index, index + size));
    index += size;
  }
  return chunks;
}

export function buildWordPartUnits(value: string): {
  units: WordPartUnit[];
  tokens: WordPartToken[];
} {
  const segments = value.match(LETTER_RUN_PATTERN) || [];
  const units: WordPartUnit[] = [];
  const tokens: WordPartToken[] = [];

  segments.forEach((segment) => {
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ]+$/.test(segment)) {
      splitLetterRun(segment).forEach((chunk) => {
        const token: WordPartToken = {
          id: `${tokens.length}-${chunk}`,
          text: chunk,
          originalIndex: tokens.length,
        };
        tokens.push(token);
        units.push({ type: "token", token });
      });
      return;
    }
    units.push({ type: "separator", text: segment });
  });

  return { units, tokens };
}

export function shuffleWordPartTokens(tokens: WordPartToken[], seed: string): WordPartToken[] {
  if (tokens.length < 2) {
    return tokens;
  }
  const shuffled = deterministicSort(tokens, seed, (token) => `${token.id}:${token.text}`);
  const keptOriginalOrder = shuffled.every((token, index) => token.originalIndex === index);
  return keptOriginalOrder ? [...shuffled].reverse() : shuffled;
}
