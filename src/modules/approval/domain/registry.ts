/** Tip → handler kaydı (ADR-0007). Çift kayıt ve eksik tip hatadır. Saf TS. */
export interface Registry<T extends { type: string }> {
  get(type: string): T;
  has(type: string): boolean;
  types(): string[];
}

export function createRegistry<T extends { type: string }>(handlers: readonly T[]): Registry<T> {
  const map = new Map<string, T>();
  for (const h of handlers) {
    if (map.has(h.type)) throw new Error(`Handler iki kez kaydedildi: ${h.type}`);
    map.set(h.type, h);
  }
  return {
    get(type) {
      const h = map.get(type);
      if (!h) throw new Error(`Handler yok: ${type}`);
      return h;
    },
    has: (type) => map.has(type),
    types: () => [...map.keys()],
  };
}
