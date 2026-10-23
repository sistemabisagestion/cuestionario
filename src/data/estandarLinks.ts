import type { EstandarLink } from '../utils/datasets';
export type { EstandarLink };

// Browser-only overrides from before centralization (see LEGACY_PREGUNTAS_KEY).
const LEGACY_LINKS_KEY = 'bisa-estandar-links';

export function legacyCustomLinks(): Record<string, EstandarLink> | null {
  try {
    const raw = localStorage.getItem(LEGACY_LINKS_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, EstandarLink> : null;
  } catch { return null; }
}
