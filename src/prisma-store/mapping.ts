import { Prisma } from '@prisma/client';

export type PrismaJsonValue = Prisma.InputJsonValue | Prisma.JsonNullValueInput;

export function toPrismaJson(value: unknown): PrismaJsonValue {
  return toJsonValue(value, true) as PrismaJsonValue;
}

function toJsonValue(value: unknown, topLevel: boolean): unknown {
  if (value === null || value === undefined) return topLevel ? Prisma.JsonNull : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite.');
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item, false));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) output[key] = toJsonValue(item, false);
    }
    return output as Prisma.InputJsonObject;
  }
  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}

export function toOptionalPrismaJson(value: unknown): PrismaJsonValue | undefined {
  return value === undefined ? undefined : toPrismaJson(value);
}

export function fromPrismaJson(value: Prisma.JsonValue | null | undefined): unknown {
  return value === null || value === undefined ? undefined : value;
}

export function toPrismaDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

export function toOptionalPrismaDate(value: string | undefined): Date | null | undefined {
  return value === undefined ? undefined : new Date(value);
}

export function fromPrismaDate(value: Date | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : value.toISOString();
}

export function toPrismaBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export function fromPrismaBigInt(value: bigint | null | undefined): bigint | undefined {
  return value === null || value === undefined ? undefined : BigInt(value);
}
