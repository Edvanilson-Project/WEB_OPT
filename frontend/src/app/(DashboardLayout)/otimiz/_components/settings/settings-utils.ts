import type { SettingsFormValues } from './settings-constants';
import { PERCENT_UI_FIELDS, NON_NUMERIC_FORM_FIELDS } from './settings-constants';

// ── Events ──
export const OPTIMIZATION_SETTINGS_DRAWER_EVENT = 'optimization:open-settings';
export const OPTIMIZATION_SETTINGS_UPDATED_EVENT = 'optimization:settings-updated';

export function openOptimizationSettingsDrawer() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMIZATION_SETTINGS_DRAWER_EVENT));
  }
}

export function notifyOptimizationSettingsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMIZATION_SETTINGS_UPDATED_EVENT));
  }
}

// ── Normalization helpers ──
function toUiPercent(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value <= 5 ? value * 100 : value;
}

function toApiPercent(value?: number | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value > 5 ? value / 100 : value;
}

function coerceNumericLike<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = { ...settings };
  for (const key of Object.keys(normalized) as Array<keyof T>) {
    if (NON_NUMERIC_FORM_FIELDS.has(key as keyof SettingsFormValues)) continue;
    const value = normalized[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
        normalized[key] = Number(trimmed) as T[keyof T];
      }
    }
  }
  return normalized;
}

export function normalizeSettingsFromApi<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = coerceNumericLike(settings);
  for (const field of PERCENT_UI_FIELDS) {
    const value = normalized[field];
    if (typeof value === 'number') {
      normalized[field] = toUiPercent(value) as T[typeof field];
    }
  }
  return normalized;
}

export function normalizeSettingsForApi<T extends Partial<SettingsFormValues>>(settings: T): T {
  const normalized = coerceNumericLike(settings);
  for (const field of PERCENT_UI_FIELDS) {
    const value = normalized[field];
    if (typeof value === 'number') {
      normalized[field] = toApiPercent(value) as T[typeof field];
    }
  }
  return normalized;
}
