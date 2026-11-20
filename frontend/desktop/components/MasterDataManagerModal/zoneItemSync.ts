import { InventoryItem, MasterData, ZoneMeta } from '../../types';

export interface ZoneItemSyncPlan {
  inventory: InventoryItem[];
  masterData: MasterData;
  additionsByCategory: Record<string, number>;
  countsByCategory: Record<string, number>;
  totalAdded: number;
  hasChanges: boolean;
  validationMessage: string | null;
}

const normalizePart = (value?: string) =>
  String(value || '').trim().toLocaleLowerCase();

const getDefinitionKey = (item: InventoryItem) =>
  [item.name, item.plating, item.spec].map(normalizePart).join('\u0000');

export const createZoneItemSyncPlan = (
  inventory: InventoryItem[],
  masterData: MasterData
): ZoneItemSyncPlan => {
  const currentNamesByCategory = masterData.namesByCategory || {};
  const categories = Array.from(new Set([
    ...(masterData.categories || []),
    ...inventory.map((item) => item.category),
  ].map((category) => String(category || '').trim()).filter(Boolean)));
  const templates = new Map<string, InventoryItem>();
  const existingByZoneAndDefinition = new Set<string>();
  const usedIds = new Set(inventory.map((item) => item.id));

  inventory.forEach((item) => {
    const name = String(item.name || '').trim();
    const category = String(item.category || '').trim();
    if (!name || !category) return;

    const definitionKey = getDefinitionKey(item);
    if (!templates.has(definitionKey)) templates.set(definitionKey, item);
    existingByZoneAndDefinition.add(
      `${normalizePart(category)}\u0001${definitionKey}`
    );
  });

  const nextInventory = [...inventory];
  const additionsByCategory: Record<string, number> = Object.fromEntries(
    categories.map((category) => [category, 0])
  );
  let totalAdded = 0;
  let idSequence = 0;
  const today = new Date().toISOString().slice(0, 10);
  const nextZoneMeta: Record<string, ZoneMeta> = { ...(masterData.zoneMeta || {}) };

  const allocateId = () => {
    let id = '';
    do {
      id = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idSequence++}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };

  categories.forEach((category) => {
    const normalizedCategory = normalizePart(category);
    templates.forEach((template, definitionKey) => {
      const zoneKey = `${normalizedCategory}\u0001${definitionKey}`;
      if (existingByZoneAndDefinition.has(zoneKey)) return;

      let zoneMeta = Object.values(nextZoneMeta).find(
        (meta) => meta.displayName === category
      );
      if (!zoneMeta) {
        const zoneId = category;
        zoneMeta = { zoneId, displayName: category, aliasHistory: [] };
        nextZoneMeta[zoneId] = zoneMeta;
      }

      nextInventory.push({
        ...template,
        id: allocateId(),
        category,
        zoneId: zoneMeta.zoneId || category,
        currentStock: 0,
        safeStock: 0,
        location: '',
        supplier: '',
        lastUpdated: today,
        orderCategory: undefined,
        orderName: undefined,
      });
      existingByZoneAndDefinition.add(zoneKey);
      additionsByCategory[category] = (additionsByCategory[category] || 0) + 1;
      totalAdded++;
    });
  });

  const commonNames = Array.from(new Set([
    ...(masterData.nameOrder || []),
    ...Object.values(currentNamesByCategory).flat(),
    ...Array.from(templates.values(), (item) => item.name.trim()),
  ].map((name) => String(name || '').trim()).filter(Boolean)));
  const nextMasterData: MasterData = {
    ...masterData,
    categories,
    namesByCategory: Object.fromEntries(
      categories.map((category) => [category, [...commonNames]])
    ),
    nameOrder: commonNames,
    zoneMeta: nextZoneMeta,
  };
  const countsByCategory = Object.fromEntries(
    categories.map((category) => [
      category,
      nextInventory.filter((item) => item.category === category).length,
    ])
  );
  const distinctCounts = new Set(Object.values(countsByCategory));
  const validationMessage = distinctCounts.size > 1
    ? '중복 품목 등으로 ZONE별 품목 수가 같아지지 않습니다. 자동 보충을 중단했습니다.'
    : null;

  return {
    inventory: nextInventory,
    masterData: nextMasterData,
    additionsByCategory,
    countsByCategory,
    totalAdded,
    hasChanges: totalAdded > 0 || JSON.stringify(nextMasterData) !== JSON.stringify(masterData),
    validationMessage,
  };
};
