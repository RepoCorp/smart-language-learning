export function hashString(value: string): number {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

export function deterministicIndex(length: number, seed: string): number {
  if (length <= 0) {
    return 0;
  }
  return Math.abs(hashString(seed)) % length;
}

export function deterministicNumber(seed: string, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  const normalized = (Math.abs(hashString(seed)) % 10000) / 9999;
  return min + ((max - min) * normalized);
}

export function deterministicSort<T>(values: T[], seed: string, toKey: (value: T, index: number) => string): T[] {
  return values
    .map((value, index) => ({
      value,
      index,
      hash: hashString(`${seed}:${toKey(value, index)}`),
    }))
    .sort((left, right) => {
      if (left.hash === right.hash) {
        return left.index - right.index;
      }
      return left.hash - right.hash;
    })
    .map(({ value }) => value);
}

export function deterministicTake<T>(values: T[], count: number, seed: string, toKey: (value: T, index: number) => string): T[] {
  if (values.length <= count) {
    return [...values];
  }
  return deterministicSort(values, seed, toKey).slice(0, count);
}
