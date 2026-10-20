import type { JsonValue, NumericValue } from './models.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function normaliseText(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text === null ? null : text.toLocaleLowerCase('en-US');
}

export function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function normaliseUnit(value: unknown): string | null {
  const text = normaliseText(value);
  if (text === null) {
    return null;
  }

  const compact = text.replace(/[\s_-]+/g, '');
  const aliases: Readonly<Record<string, string>> = {
    tco2e: 'tco2e',
    tco2eq: 'tco2e',
    tonneco2e: 'tco2e',
    tonnesco2e: 'tco2e',
    tonco2e: 'tco2e',
    tonsco2e: 'tco2e',
  };
  return aliases[compact] ?? compact;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const numberValue = Number(value.trim());
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

export function parseDateValue(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function stableSerialize(value: unknown, seen = new Set<unknown>()): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? 'NaN' : Number.isFinite(value) ? value.toString() : String(value);
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }
  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => stableSerialize(item, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }

  const object = value as Record<string, unknown>;
  const serialized = `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key], seen)}`)
    .join(',')}}`;
  seen.delete(value);
  return serialized;
}

export function shortHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]));
  }
  return String(value);
}

export function asNumericValue(value: unknown): NumericValue | null {
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') {
    return value;
  }
  return null;
}

export function roundScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
