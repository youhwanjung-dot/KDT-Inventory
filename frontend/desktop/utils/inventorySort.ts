type CategoryOrderMap = Map<string, number>;

export interface InventorySortableLike {
  category?: string | null;
  name?: string | null;
  plating?: string | null;
  spec?: string | null;
  id?: string | null;
}

const koItemCollator = new Intl.Collator('ko', {
  numeric: true,
  sensitivity: 'base',
});

const normalizeSortValue = (value: string | null | undefined): string => String(value || '').trim();

export const compareKoreanNaturalText = (
  a: string | null | undefined,
  b: string | null | undefined,
): number => koItemCollator.compare(normalizeSortValue(a), normalizeSortValue(b));

export const compareCategoryWithOrder = (
  aCategory: string | null | undefined,
  bCategory: string | null | undefined,
  categoryOrderMap?: CategoryOrderMap,
): number => {
  const normalizedA = normalizeSortValue(aCategory);
  const normalizedB = normalizeSortValue(bCategory);

  if (categoryOrderMap) {
    const orderA = categoryOrderMap.get(normalizedA);
    const orderB = categoryOrderMap.get(normalizedB);
    if (orderA !== undefined && orderB !== undefined) {
      if (orderA !== orderB) return orderA - orderB;
    } else if (orderA !== undefined) {
      return -1;
    } else if (orderB !== undefined) {
      return 1;
    }
  }

  return compareKoreanNaturalText(normalizedA, normalizedB);
};

export const compareInventoryItems = <T extends InventorySortableLike>(
  a: T,
  b: T,
  categoryOrderMap?: CategoryOrderMap,
): number => {
  const categoryOrder = compareCategoryWithOrder(a.category, b.category, categoryOrderMap);
  if (categoryOrder !== 0) return categoryOrder;

  const nameOrder = compareKoreanNaturalText(a.name, b.name);
  if (nameOrder !== 0) return nameOrder;

  const platingOrder = compareKoreanNaturalText(a.plating, b.plating);
  if (platingOrder !== 0) return platingOrder;

  const specOrder = compareKoreanNaturalText(a.spec, b.spec);
  if (specOrder !== 0) return specOrder;

  return compareKoreanNaturalText(a.id, b.id);
};

export const sortInventoryItems = <T extends InventorySortableLike>(
  items: T[],
  categoryOrderMap?: CategoryOrderMap,
): T[] => [...items].sort((a, b) => compareInventoryItems(a, b, categoryOrderMap));
