import { deterministicSort } from "../deterministic";

const LETTER_RUN_PATTERN = /([A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+)/g;

const PROTECTED_PREFIXES = [
  "ent", "ver", "zer", "be", "ge", "er", "ab", "an", "auf", "aus", "ein", "mit", "nach", "vor", "weg", "zurück", "zu",
];
const PROTECTED_SUFFIXES = [
  "lichkeit", "igkeit", "schaft", "heit", "keit", "ung", "chen", "lein", "lich", "isch", "bar", "ern", "eln", "en", "ig",
];
const PROTECTED_VOWEL_CLUSTERS = ["ai", "au", "äu", "ei", "eu", "ie", "aa", "ee", "oo"];
const PROTECTED_CONSONANT_CLUSTERS = [
  "schw", "schr", "schl", "schn", "str", "spr", "sch", "ch", "ck", "ph", "th", "qu", "sp", "st",
];
const VOWEL_PATTERN = /^[aeiouyäöü]/i;
const LETTER_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ]$/;

export type WordPartToken = {
  id: string;
  text: string;
  originalIndex: number;
};

export type WordPartUnit =
  | { type: "token"; token: WordPartToken }
  | { type: "separator"; text: string };

type ChunkUnit = {
  text: string;
  protected: boolean;
};

function longestMatchAt(value: string, index: number, patterns: string[]): string | null {
  const remainder = value.slice(index).toLowerCase();
  let match: string | null = null;

  patterns.forEach((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    if (remainder.startsWith(normalizedPattern) && (!match || pattern.length > match.length)) {
      match = pattern;
    }
  });
  return match;
}

function longestSuffix(value: string, minimumStart: number): string | null {
  const normalizedValue = value.toLowerCase();
  let match: string | null = null;

  PROTECTED_SUFFIXES.forEach((pattern) => {
    if (
      normalizedValue.endsWith(pattern.toLowerCase())
      && value.length - pattern.length >= minimumStart
      && (!match || pattern.length > match.length)
    ) {
      match = pattern;
    }
  });
  return match;
}

function mergeUnits(units: ChunkUnit[], leftIndex: number): void {
  const left = units[leftIndex];
  const right = units[leftIndex + 1];
  if (!left || !right) {
    return;
  }
  units.splice(leftIndex, 2, {
    text: `${left.text}${right.text}`,
    // Joining a protected pattern may enlarge it, but never splits it apart.
    protected: left.protected || right.protected,
  });
}

function isSingleConsonant(unit: ChunkUnit): boolean {
  return !unit.protected && LETTER_PATTERN.test(unit.text) && !VOWEL_PATTERN.test(unit.text);
}

function isSingleVowel(unit: ChunkUnit): boolean {
  return !unit.protected && unit.text.length === 1 && VOWEL_PATTERN.test(unit.text);
}

function eliminateSingleConsonants(units: ChunkUnit[]): void {
  let index = 0;
  while (index < units.length) {
    if (!isSingleConsonant(units[index])) {
      index += 1;
      continue;
    }
    if (units[index + 1] && VOWEL_PATTERN.test(units[index + 1].text)) {
      mergeUnits(units, index);
      index += 1;
      continue;
    }
    if (index > 0) {
      mergeUnits(units, index - 1);
      index = Math.max(0, index - 1);
      continue;
    }
    index += 1;
  }
}

function eliminateSingleVowels(units: ChunkUnit[]): void {
  let index = 0;
  while (index < units.length) {
    if (!isSingleVowel(units[index])) {
      index += 1;
      continue;
    }
    if (units[index + 1]) {
      mergeUnits(units, index);
      index += 1;
      continue;
    }
    if (index > 0) {
      mergeUnits(units, index - 1);
      index = Math.max(0, index - 1);
      continue;
    }
    index += 1;
  }
}

function mergeRemainingNonProtectedSingles(units: ChunkUnit[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < units.length; index += 1) {
      if (units[index].protected || units[index].text.length !== 1) {
        continue;
      }
      if (units[index + 1] && !units[index + 1].protected) {
        mergeUnits(units, index);
        changed = true;
        break;
      }
      if (index > 0 && !units[index - 1].protected) {
        mergeUnits(units, index - 1);
        changed = true;
        break;
      }
    }
  }
}

function splitLetterRun(value: string): string[] {
  const prefix = longestMatchAt(value, 0, PROTECTED_PREFIXES);
  const prefixLength = prefix?.length || 0;
  const suffix = longestSuffix(value, prefixLength);
  const suffixStart = suffix ? value.length - suffix.length : value.length;
  const chunks: ChunkUnit[] = [];

  if (prefix) {
    chunks.push({ text: value.slice(0, prefixLength), protected: true });
  }

  for (let index = prefixLength; index < suffixStart;) {
    const vowelCluster = longestMatchAt(value, index, PROTECTED_VOWEL_CLUSTERS);
    const consonantCluster = longestMatchAt(value, index, PROTECTED_CONSONANT_CLUSTERS);
    const cluster = [vowelCluster, consonantCluster]
      .filter((candidate): candidate is string => Boolean(candidate))
      .sort((left, right) => right.length - left.length)[0];
    if (cluster) {
      chunks.push({ text: value.slice(index, index + cluster.length), protected: true });
      index += cluster.length;
      continue;
    }
    chunks.push({ text: value[index], protected: false });
    index += 1;
  }

  if (suffix) {
    chunks.push({ text: value.slice(suffixStart), protected: true });
  }

  eliminateSingleConsonants(chunks);
  eliminateSingleVowels(chunks);
  mergeRemainingNonProtectedSingles(chunks);
  return chunks.map((chunk) => chunk.text);
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
