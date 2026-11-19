import { InventoryItem } from '../types';

/**
 * KDT-Inventory numeric & item display formatters.
 * All stock & transaction values are managed in integer EA (C1 confirmed).
 */

export const roundToInt = (
  value: number | string | undefined | null,
  fallback = 0
): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(typeof value === 'string' ? value.replace(/,/g, '').trim() : value);
  if (Number.isNaN(num)) return fallback;
  return Math.round(num);
};

/** Formats an integer EA value with thousands separators (e.g. 55000 -> "55,000"). */
export const formatInteger = (
  value: number | string | undefined | null,
  fallback = '0'
): string => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = roundToInt(value, NaN);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('ko-KR');
};

/**
 * Formats stock in integer EA, appending converted SET/BOX reference when eaPerUnit > 1.
 * Example: (22000, 'SET', 2) -> "22,000 EA (11,000 SET)"
 */
export const formatStockWithUnit = (
  eaQty: number | undefined | null,
  unit?: string,
  eaPerUnit?: number
): string => {
  const ea = roundToInt(eaQty, 0);
  const formattedEa = ea.toLocaleString('ko-KR');
  const per = roundToInt(eaPerUnit, 1);
  if (per > 1 && unit && unit.toUpperCase() !== 'EA') {
    const converted = ea / per;
    const convStr = Number.isInteger(converted)
      ? converted.toLocaleString('ko-KR')
      : converted.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    return `${formattedEa} EA (${convStr} ${unit})`;
  }
  return `${formattedEa} EA`;
};

/**
 * Builds a unique human-readable item key for Excel matrix headers and dropdowns.
 * Example: ("육각쎔스볼트", "3가", "M6*16") -> "육각쎔스볼트 [3가/M6*16]"
 */
export const formatItemDisplayKey = (
  item: Pick<InventoryItem, 'name' | 'plating' | 'spec'>
): string => {
  const name = (item.name || '').trim();
  const parts = [item.plating?.trim(), item.spec?.trim()].filter(Boolean);
  if (parts.length === 0) return name;
  return `${name} [${parts.join('/')}]`;
};

// Backward-compatible aliases for migrated Asan components (integer EA precision)
export const formatOneDecimal = (
  value: number | string | undefined | null,
  fallback = ''
): string => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = roundToInt(value, NaN);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('ko-KR');
};

export const roundToOneDecimal = (
  value: number | string | undefined | null,
  fallback = 0
): number => roundToInt(value, fallback);

export const formatFlexibleDecimal = (
  value: number | string | undefined | null,
  fallback = '0'
): string => formatInteger(value, fallback);

/** Alias for formatStockWithUnit (for compatibility) */
export const formatStockWithRef = formatStockWithUnit;

