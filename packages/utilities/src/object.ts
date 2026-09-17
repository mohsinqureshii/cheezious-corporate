/** Small object/array helpers shared across packages. */

export function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

export function omit<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omit<T, K> {
  const out = { ...source } as T;
  for (const key of keys) delete out[key];
  return out as Omit<T, K>;
}

export function compact<T>(items: ReadonlyArray<T | null | undefined | false>): T[] {
  return items.filter((item): item is T => item !== null && item !== undefined && item !== false);
}

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyOf(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Stable, deterministic JSON — used for revision diffing and content hashing. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/** True when two values are deeply equal by stable serialisation. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
