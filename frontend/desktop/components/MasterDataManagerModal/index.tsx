import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Box,
  Edit2,
  Trash2,
  ArrowRight,
  Save,
  GripVertical,
  RefreshCw,
  Sliders,
  Plus,
  ChevronLeft,
  Factory,
  Layers,
} from 'lucide-react';
import { InventoryItem, MasterData, ZoneMeta } from '../../types';
import { ActionLogger } from '../../utils/logger';
import { api } from '../../utils/api';
import { AnalysisResult, MasterDataManagerModalProps, TAB_CONFIG, TargetField } from './types';
import { createZoneItemSyncPlan, ZoneItemSyncPlan } from './zoneItemSync';
import ZoneMetaModal from './ZoneMetaModal';
import AnalysisConfirmModal from './AnalysisConfirmModal';

const getItemDefinitionKey = (item: InventoryItem) =>
  [item.name, item.plating, item.spec]
    .map((part) => String(part || '').trim().toLocaleLowerCase())
    .join('\u0000');

const MasterDataManagerModal: React.FC<MasterDataManagerModalProps> = ({
  inventory,
  transactions,
  masterData: masterDataProp,
  onMasterDataChange,
  onUpdateInventory,
  onNormalizeZoneItems,
  onCreateZoneItems,
  onCreateItems,
  onEditItem,
  onClose,
}) => {
  const [activeTabKey, setActiveTabKey] = useState<TargetField>('category');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [zoneMetaTarget, setZoneMetaTarget] = useState<{ name: string; meta: ZoneMeta } | null>(null);

  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState('');
  const [addCategoryResult, setAddCategoryResult] = useState('');
  const [newNameValue, setNewNameValue] = useState('');
  const [isAddingSubName, setIsAddingSubName] = useState(false);
  const [showSubNameScopePrompt, setShowSubNameScopePrompt] = useState(false);
  const [addSubNameError, setAddSubNameError] = useState('');
  const [showExistingItemPicker, setShowExistingItemPicker] = useState(false);
  const [sourceZone, setSourceZone] = useState('');
  const [existingItemSearch, setExistingItemSearch] = useState('');
  const [selectedExistingItemKeys, setSelectedExistingItemKeys] = useState<Set<string>>(new Set());
  const [isAddingExistingItems, setIsAddingExistingItems] = useState(false);
  const [existingItemError, setExistingItemError] = useState('');
  const [existingItemResult, setExistingItemResult] = useState('');
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [draggingValue, setDraggingValue] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isSyncingZoneItems, setIsSyncingZoneItems] = useState(false);
  const [zoneSyncResult, setZoneSyncResult] = useState<string | null>(null);
  const [pendingZoneSync, setPendingZoneSync] = useState<ZoneItemSyncPlan | null>(null);

  const [customMasterData, setCustomMasterData] = useState<MasterData>({
    categories: masterDataProp.categories || [],
    namesByCategory: masterDataProp.namesByCategory || {},
    nameOrder: masterDataProp.nameOrder || [],
    zoneMeta: masterDataProp.zoneMeta || {},
  });

  // One-time bootstrap from inventory if masterData is empty
  useEffect(() => {
    const hasCats = (masterDataProp.categories || []).length > 0;
    if (!hasCats && inventory.length > 0) {
      const builtNamesByCategory: Record<string, string[]> = {};
      const builtZoneMeta: Record<string, ZoneMeta> = { ...(masterDataProp.zoneMeta || {}) };
      inventory.forEach((item) => {
        const cat = (item.category || '').trim();
        const name = (item.name || '').trim();
        if (!cat) return;
        if (!builtNamesByCategory[cat]) builtNamesByCategory[cat] = [];
        if (name && !builtNamesByCategory[cat].includes(name)) builtNamesByCategory[cat].push(name);
        if (!Object.values(builtZoneMeta).some((z) => z.displayName === cat)) {
          const zId = item.zoneId || cat;
          builtZoneMeta[zId] = { zoneId: zId, displayName: cat, aliasHistory: [] };
        }
      });
      const builtCategories = Object.keys(builtNamesByCategory);
      const builtNameOrder = Array.from(new Set(Object.values(builtNamesByCategory).flat()));
      const migrated: MasterData = {
        categories: builtCategories,
        namesByCategory: builtNamesByCategory,
        nameOrder: builtNameOrder,
        zoneMeta: builtZoneMeta,
      };
      api.saveMasterData(migrated).catch(() => {});
      setCustomMasterData(migrated);
      onMasterDataChange(migrated);
    }
  }, []);

  const persistMasterData = (updater: (prev: MasterData) => MasterData) => {
    setCustomMasterData((prev) => {
      const next = updater(prev);
      onMasterDataChange(next);
      api.saveMasterData(next).catch((err) => console.error('[MasterData] Save failed:', err));
      return next;
    });
  };

  const getZoneMetaForName = (catName: string): ZoneMeta => {
    const metas = customMasterData.zoneMeta || {};
    const found = Object.values(metas).find((m) => m.displayName === catName);
    if (found) return found;
    return {
      zoneId: `Z-${catName.replace(/[^A-Za-z0-9_]/g, '') || Date.now()}`,
      displayName: catName,
      aliasHistory: [],
    };
  };

  // 재고 레코드가 없는(기준정보에만 등록된) 품명을 전체수정모달로 열기 위한 초안 품목
  const createDraftItem = (category: string, name: string): InventoryItem => {
    const zoneMeta = getZoneMetaForName(category);
    return {
      id: '',
      category,
      zoneId: zoneMeta.zoneId,
      name,
      plating: '',
      spec: '',
      unit: 'EA',
      eaPerUnit: 1,
      qtyPerProduct: 0,
      setGroup: '',
      pkgUnit: '',
      pkgType: '',
      outerPkg: '',
      currentStock: 0,
      safeStock: 0,
      location: '',
      supplier: '',
      note: '',
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
  };

  const effectiveTabKey: TargetField = drillCategory !== null ? 'name' : activeTabKey;

  const categoryOptions = useMemo(() => {
    const fromInv = inventory.map((i) => i.category).filter(Boolean);
    const ordered = [...(customMasterData.categories || [])];
    fromInv.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }, [inventory, customMasterData.categories]);

  const commonItemTemplates = useMemo(() => {
    if (categoryOptions.length === 0) return [];
    const definitionsByCategory = categoryOptions.map((category) => {
      const definitions = new Map<string, InventoryItem>();
      inventory.forEach((item) => {
        if (item.category !== category || !item.name.trim()) return;
        const key = getItemDefinitionKey(item);
        if (!definitions.has(key)) definitions.set(key, item);
      });
      return definitions;
    });
    const firstCategoryDefinitions = definitionsByCategory[0];
    return Array.from(firstCategoryDefinitions.entries())
      .filter(([key]) => definitionsByCategory.every((definitions) => definitions.has(key)))
      .map(([, item]) => item);
  }, [categoryOptions, inventory]);

  const sourceZoneOptions = useMemo(
    () => categoryOptions.filter((category) => category !== drillCategory),
    [categoryOptions, drillCategory]
  );
  const selectedSourceZone = sourceZoneOptions.includes(sourceZone)
    ? sourceZone
    : sourceZoneOptions[0] || '';
  const availableExistingItems = useMemo(() => {
    if (!drillCategory || !selectedSourceZone) return [];
    const targetKeys = new Set(
      inventory
        .filter((item) => item.category === drillCategory)
        .map(getItemDefinitionKey)
    );
    const sourceDefinitions = new Map<string, InventoryItem>();
    inventory.forEach((item) => {
      if (item.category !== selectedSourceZone || !item.name.trim()) return;
      const key = getItemDefinitionKey(item);
      if (!targetKeys.has(key) && !sourceDefinitions.has(key)) sourceDefinitions.set(key, item);
    });
    const query = existingItemSearch.trim().toLocaleLowerCase();
    return Array.from(sourceDefinitions.values())
      .filter((item) =>
        [item.name, item.plating, item.spec]
          .some((part) => String(part || '').toLocaleLowerCase().includes(query))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drillCategory, existingItemSearch, inventory, selectedSourceZone]);

  const zoneItemSyncPlan = useMemo(
    () => createZoneItemSyncPlan(inventory, customMasterData),
    [inventory, customMasterData]
  );

  const dataEntries = useMemo<[string, number][]>(() => {
    const map = new Map<string, number>();
    if (effectiveTabKey === 'category') {
      categoryOptions.forEach((c) => map.set(c, 0));
      inventory.forEach((item) => {
        if (item.category) map.set(item.category, (map.get(item.category) || 0) + 1);
      });
      return Array.from(map.entries());
    }

    if (effectiveTabKey === 'name' && drillCategory) {
      const customNames = customMasterData.namesByCategory[drillCategory] || [];
      customNames.forEach((n) => map.set(n, 0));
      inventory
        .filter((i) => i.category === drillCategory)
        .forEach((i) => {
          if (i.name) map.set(i.name, (map.get(i.name) || 0) + 1);
        });
      return Array.from(map.entries());
    }

    inventory.forEach((item) => {
      const val = String((item as any)[effectiveTabKey] || '').trim();
      if (val) map.set(val, (map.get(val) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [effectiveTabKey, drillCategory, categoryOptions, customMasterData, inventory]);

  // Add new ZONE
  const handleAddCategory = async () => {
    const trimmed = newCategoryValue.trim();
    if (!trimmed || categoryOptions.includes(trimmed) || isAddingCategory) return;
    const newZoneId = `Z-${Date.now().toString(36).toUpperCase()}`;
    setIsAddingCategory(true);
    setAddCategoryError('');
    setAddCategoryResult('');
    try {
      const orderedDefinitions = [...commonItemTemplates].sort((a, b) => {
        const orderA = customMasterData.nameOrder.indexOf(a.name);
        const orderB = customMasterData.nameOrder.indexOf(b.name);
        if (orderA >= 0 && orderB >= 0 && orderA !== orderB) return orderA - orderB;
        if (orderA >= 0) return -1;
        if (orderB >= 0) return 1;
        return a.name.localeCompare(b.name);
      });
      const today = new Date().toISOString().slice(0, 10);
      const nextNameOrder = Array.from(
        new Set([...customMasterData.nameOrder, ...orderedDefinitions.map((item) => item.name)])
      );
      const usedItemIds = new Set(inventory.map((item) => item.id));
      let idSequence = 0;
      const allocateItemId = () => {
        let id = '';
        do {
          id = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${idSequence++}`;
        } while (usedItemIds.has(id));
        usedItemIds.add(id);
        return id;
      };
      const newItems = orderedDefinitions.map((template): InventoryItem => ({
        ...template,
        id: allocateItemId(),
        category: trimmed,
        zoneId: newZoneId,
        currentStock: 0,
        safeStock: 0,
        location: '',
        supplier: '',
        lastUpdated: today,
        orderCategory: categoryOptions.length,
        orderName: nextNameOrder.indexOf(template.name),
      }));
      const nextMasterData: MasterData = {
        ...customMasterData,
        categories: Array.from(new Set([...customMasterData.categories, ...categoryOptions, trimmed])),
        namesByCategory: {
          ...customMasterData.namesByCategory,
          [trimmed]: Array.from(new Set(newItems.map((item) => item.name))),
        },
        nameOrder: nextNameOrder,
        zoneMeta: {
          ...(customMasterData.zoneMeta || {}),
          [newZoneId]: { zoneId: newZoneId, displayName: trimmed, aliasHistory: [] },
        },
      };

      const result = await onCreateZoneItems(trimmed, newItems, nextMasterData);
      setCustomMasterData(result.masterData);
      onMasterDataChange(result.masterData);
      setNewCategoryValue('');
      setAddCategoryResult(
        result.failedItemCount > 0
          ? `대분류 추가 완료: 품목 ${result.savedItemCount}종 저장, ${result.failedItemCount}종 저장 실패`
          : `대분류 추가 완료: 공통 품목 ${result.savedItemCount}종을 현재고 0으로 추가`
      );
      ActionLogger.log('ZONE Created with common item definitions', {
        zone: trimmed,
        zoneId: newZoneId,
        itemCount: result.savedItemCount,
        failedItemCount: result.failedItemCount,
      });
    } catch (error) {
      console.error('Failed to create ZONE with shared item definitions:', error);
      setAddCategoryError(error instanceof Error ? error.message : '대분류 추가에 실패했습니다.');
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Add new item name inside drilled ZONE
  const handleAddSubName = async () => {
    if (!drillCategory || isAddingSubName || showSubNameScopePrompt) return;
    const trimmed = newNameValue.trim();
    if (!trimmed) {
      setAddSubNameError('신규 품명을 입력한 후 품목 추가를 눌러 주세요.');
      newNameInputRef.current?.focus();
      return;
    }
    setShowSubNameScopePrompt(true);
  };
  const confirmAddSubName = async (applyAcrossZones: boolean) => {
    if (!drillCategory || isAddingSubName) return;
    const trimmed = newNameValue.trim();
    const categories = applyAcrossZones
      ? Array.from(new Set([...categoryOptions, drillCategory]))
      : [drillCategory];
    setShowSubNameScopePrompt(false);
    setIsAddingSubName(true);
    setAddSubNameError('');
    const nextNamesByCategory = { ...customMasterData.namesByCategory };
    categories.forEach((category) => {
      const existing = nextNamesByCategory[category] || [];
      if (!existing.includes(trimmed)) {
        nextNamesByCategory[category] = [...existing, trimmed];
      }
    });
    const nextMasterData: MasterData = {
      ...customMasterData,
      namesByCategory: nextNamesByCategory,
      nameOrder: customMasterData.nameOrder.includes(trimmed)
        ? customMasterData.nameOrder
        : [...customMasterData.nameOrder, trimmed],
    };
    try {
      await api.saveMasterData(nextMasterData);
      setCustomMasterData(nextMasterData);
      onMasterDataChange(nextMasterData);
      await onCreateItems?.(categories, trimmed);
      setNewNameValue('');
    } catch (error) {
      console.error('Failed to create shared inventory items:', error);
      setAddSubNameError(error instanceof Error ? error.message : '품목 등록에 실패했습니다.');
    } finally {
      setIsAddingSubName(false);
    }
  };

  const openExistingItemPicker = () => {
    setSourceZone(sourceZoneOptions[0] || '');
    setExistingItemSearch('');
    setSelectedExistingItemKeys(new Set());
    setExistingItemError('');
    setExistingItemResult('');
    setShowExistingItemPicker(true);
  };

  const handleAddSelectedExistingItems = async () => {
    if (!drillCategory || isAddingExistingItems) return;
    const targetKeys = new Set(
      inventory
        .filter((item) => item.category === drillCategory)
        .map(getItemDefinitionKey)
    );
    const selectedTemplates = availableExistingItems.filter(
      (item) => selectedExistingItemKeys.has(getItemDefinitionKey(item)) &&
        !targetKeys.has(getItemDefinitionKey(item))
    );
    if (selectedTemplates.length === 0) {
      setExistingItemError('대상 ZONE에 추가할 품목을 선택해 주세요.');
      return;
    }

    setIsAddingExistingItems(true);
    setExistingItemError('');
    const nextNameOrder = Array.from(
      new Set([...customMasterData.nameOrder, ...selectedTemplates.map((item) => item.name)])
    );
    const usedItemIds = new Set(inventory.map((item) => item.id));
    let idSequence = 0;
    const allocateItemId = () => {
      let id = '';
      do {
        id = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${idSequence++}`;
      } while (usedItemIds.has(id));
      usedItemIds.add(id);
      return id;
    };
    const zoneMeta = getZoneMetaForName(drillCategory);
    const today = new Date().toISOString().slice(0, 10);
    const newItems = selectedTemplates.map((template): InventoryItem => ({
      ...template,
      id: allocateItemId(),
      category: drillCategory,
      zoneId: zoneMeta.zoneId,
      currentStock: 0,
      safeStock: 0,
      location: '',
      supplier: '',
      lastUpdated: today,
      orderCategory: Math.max(0, categoryOptions.indexOf(drillCategory)),
      orderName: nextNameOrder.indexOf(template.name),
    }));
    const nextMasterData: MasterData = {
      ...customMasterData,
      categories: Array.from(new Set([...customMasterData.categories, ...categoryOptions, drillCategory])),
      namesByCategory: {
        ...customMasterData.namesByCategory,
        [drillCategory]: Array.from(new Set([
          ...(customMasterData.namesByCategory[drillCategory] || []),
          ...newItems.map((item) => item.name),
        ])),
      },
      nameOrder: nextNameOrder,
      zoneMeta: {
        ...(customMasterData.zoneMeta || {}),
        [zoneMeta.zoneId]: zoneMeta,
      },
    };

    try {
      const result = await onCreateZoneItems(drillCategory, newItems, nextMasterData);
      setCustomMasterData(result.masterData);
      onMasterDataChange(result.masterData);
      setExistingItemResult(
        result.failedItemCount > 0
          ? `${result.savedItemCount}개 추가, ${result.failedItemCount}개 저장 실패`
          : `${result.savedItemCount}개 품목을 ${drillCategory}에 현재고 0으로 추가했습니다.`
      );
      if (result.failedItemCount > 0) {
        setExistingItemError('실패한 품목은 선택 창에서 다시 시도할 수 있습니다.');
      } else {
        setShowExistingItemPicker(false);
        setSelectedExistingItemKeys(new Set());
      }
      ActionLogger.log('Existing Items Added to ZONE', {
        sourceZone: selectedSourceZone,
        targetZone: drillCategory,
        saved: result.savedItemCount,
        failed: result.failedItemCount,
      });
    } catch (error) {
      console.error('Failed to add selected items to ZONE:', error);
      setExistingItemError(error instanceof Error ? error.message : '기존 품목 추가에 실패했습니다.');
    } finally {
      setIsAddingExistingItems(false);
    }
  };

  // Save ZONE alias / customer / plannedProductionQty
  const handleSaveZoneMeta = (oldName: string, updatedMeta: ZoneMeta) => {
    const newName = updatedMeta.displayName;
    const isRenamed = newName !== oldName;

    persistMasterData((prev) => {
      const nextCategories = isRenamed
        ? prev.categories.map((c) => (c === oldName ? newName : c))
        : prev.categories.includes(newName)
        ? prev.categories
        : [...prev.categories, newName];

      const nextNamesByCat = { ...prev.namesByCategory };
      if (isRenamed && nextNamesByCat[oldName]) {
        nextNamesByCat[newName] = Array.from(
          new Set([...(nextNamesByCat[newName] || []), ...nextNamesByCat[oldName]])
        );
        delete nextNamesByCat[oldName];
      }

      return {
        ...prev,
        categories: nextCategories,
        namesByCategory: nextNamesByCat,
        zoneMeta: {
          ...(prev.zoneMeta || {}),
          [updatedMeta.zoneId]: updatedMeta,
        },
      };
    });

    if (isRenamed) {
      const changed: InventoryItem[] = [];
      const nextInventory = inventory.map((item) => {
        if (item.category === oldName) {
          const upd = { ...item, category: newName, zoneId: updatedMeta.zoneId };
          changed.push(upd);
          return upd;
        }
        return item;
      });
      if (changed.length > 0) {
        onUpdateInventory(nextInventory, changed);
      }
      ActionLogger.log('ZONE Alias Renamed', { from: oldName, to: newName, zoneId: updatedMeta.zoneId });
    } else {
      ActionLogger.log('ZONE Meta Updated', { zone: newName, plannedQty: updatedMeta.plannedProductionQty });
    }

    setZoneMetaTarget(null);
  };

  // Trigger impact analysis for rename/delete/move
  const requestUpdate = (targetValue: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed || trimmed === targetValue) {
      setEditingValue(null);
      return;
    }
    const affected = inventory.filter((item) => {
      if (effectiveTabKey === 'name' && drillCategory) {
        return item.category === drillCategory && item.name === targetValue;
      }
      return String((item as any)[effectiveTabKey] || '') === targetValue;
    });
    setAnalysis({
      type: 'UPDATE',
      field: effectiveTabKey,
      targetValue,
      newValue: trimmed,
      affectedCount: affected.length,
      affectedSample: affected.slice(0, 8).map((i) => `[${i.category}] ${i.name} ${i.spec || ''}`),
    });
  };

  const requestDelete = (targetValue: string) => {
    const affected = inventory.filter((item) => {
      if (effectiveTabKey === 'name' && drillCategory) {
        return item.category === drillCategory && item.name === targetValue;
      }
      return String((item as any)[effectiveTabKey] || '') === targetValue;
    });
    const inventoryById = new Map(inventory.map((item) => [item.id, item]));
    const relatedTransactions =
      effectiveTabKey === 'name' && drillCategory
        ? transactions.filter((tx) => {
            const linkedItem = inventoryById.get(tx.itemId);
            if (linkedItem) {
              return linkedItem.name === targetValue && linkedItem.category !== drillCategory;
            }
            return tx.itemName === targetValue && tx.category !== drillCategory;
          })
        : [];
    const historyByCategory = new Map<string, number>();
    relatedTransactions.forEach((tx) => {
      const category = tx.category || tx.zoneId || '기타';
      historyByCategory.set(category, (historyByCategory.get(category) || 0) + 1);
    });
    setAnalysis({
      type: effectiveTabKey === 'name' ? 'DELETE_SUBCATEGORY' : 'DELETE',
      field: effectiveTabKey,
      targetValue,
      newValue: '',
      affectedCount: affected.length,
      affectedSample: affected.slice(0, 8).map((i) => `[${i.category}] ${i.name} ${i.spec || ''}`),
      relatedHistory:
        relatedTransactions.length > 0 && drillCategory
          ? {
              currentCategory: drillCategory,
              totalTransactions: relatedTransactions.length,
              byCategory: Array.from(historyByCategory, ([category, count]) => ({ category, count })),
            }
          : undefined,
    });
  };

  const requestMoveSubcategory = (name: string, targetZone: string) => {
    if (!drillCategory || !targetZone || targetZone === drillCategory) return;
    const affected = inventory.filter((i) => i.category === drillCategory && i.name === name);
    setAnalysis({
      type: 'MOVE_SUBCATEGORY',
      field: 'name',
      targetValue: name,
      newValue: targetZone,
      affectedCount: affected.length,
      affectedSample: affected.slice(0, 8).map((i) => `${i.name} (${i.spec || '-'})`),
      moveSourceCategories: [drillCategory],
    });
  };

  const executeAnalysis = () => {
    if (!analysis) return;
    const { type, field, targetValue, newValue } = analysis;

    if (type === 'UPDATE') {
      if (field === 'category') {
        const meta = getZoneMetaForName(targetValue);
        handleSaveZoneMeta(targetValue, { ...meta, displayName: newValue });
      } else {
        const changed: InventoryItem[] = [];
        const nextInv = inventory.map((item) => {
          const match =
            field === 'name' && drillCategory
              ? item.category === drillCategory && item.name === targetValue
              : String((item as any)[field] || '') === targetValue;
          if (!match) return item;
          const upd = { ...item, [field]: newValue };
          changed.push(upd);
          return upd;
        });
        if (field === 'name' && drillCategory) {
          persistMasterData((prev) => ({
            ...prev,
            namesByCategory: {
              ...prev.namesByCategory,
              [drillCategory]: (prev.namesByCategory[drillCategory] || []).map((n) =>
                n === targetValue ? newValue : n
              ),
            },
          }));
        }
        if (changed.length > 0) onUpdateInventory(nextInv, changed);
      }
    } else if (type === 'DELETE' || type === 'DELETE_SUBCATEGORY') {
      if (field === 'category') {
        const deleteIds = inventory.filter((i) => i.category === targetValue).map((i) => i.id);
        persistMasterData((prev) => {
          const nextNames = { ...prev.namesByCategory };
          delete nextNames[targetValue];
          return {
            ...prev,
            categories: prev.categories.filter((c) => c !== targetValue),
            namesByCategory: nextNames,
          };
        });
        onUpdateInventory(
          inventory.filter((i) => i.category !== targetValue),
          [],
          deleteIds
        );
      } else if (field === 'name' && drillCategory) {
        const deleteIds = inventory
          .filter((i) => i.category === drillCategory && i.name === targetValue)
          .map((i) => i.id);
        persistMasterData((prev) => ({
          ...prev,
          namesByCategory: {
            ...prev.namesByCategory,
            [drillCategory]: (prev.namesByCategory[drillCategory] || []).filter((n) => n !== targetValue),
          },
        }));
        onUpdateInventory(
          inventory.filter((i) => !(i.category === drillCategory && i.name === targetValue)),
          [],
          deleteIds
        );
      } else {
        const changed: InventoryItem[] = [];
        const nextInv = inventory.map((item) => {
          if (String((item as any)[field] || '') !== targetValue) return item;
          const upd = { ...item, [field]: '' };
          changed.push(upd);
          return upd;
        });
        if (changed.length > 0) onUpdateInventory(nextInv, changed);
      }
    } else if (type === 'MOVE_SUBCATEGORY' && drillCategory) {
      const targetMeta = getZoneMetaForName(newValue);
      const changed: InventoryItem[] = [];
      const nextInv = inventory.map((item) => {
        if (item.category === drillCategory && item.name === targetValue) {
          const upd = { ...item, category: newValue, zoneId: targetMeta.zoneId };
          changed.push(upd);
          return upd;
        }
        return item;
      });
      persistMasterData((prev) => ({
        ...prev,
        namesByCategory: {
          ...prev.namesByCategory,
          [drillCategory]: (prev.namesByCategory[drillCategory] || []).filter((n) => n !== targetValue),
          [newValue]: Array.from(new Set([...(prev.namesByCategory[newValue] || []), targetValue])),
        },
      }));
      if (changed.length > 0) onUpdateInventory(nextInv, changed);
    }

    setEditingValue(null);
    setAnalysis(null);
  };

  // Drag reorder for ZONEs or drilled item names
  const handleDrop = (targetVal: string) => {
    if (!draggingValue || draggingValue === targetVal) return;
    if (effectiveTabKey === 'category') {
      const list = [...categoryOptions];
      const fromIdx = list.indexOf(draggingValue);
      const toIdx = list.indexOf(targetVal);
      if (fromIdx === -1 || toIdx === -1) return;
      list.splice(fromIdx, 1);
      list.splice(toIdx, 0, draggingValue);
      persistMasterData((prev) => ({ ...prev, categories: list }));
    } else if (effectiveTabKey === 'name' && drillCategory) {
      const list = dataEntries.map(([n]) => n);
      const fromIdx = list.indexOf(draggingValue);
      const toIdx = list.indexOf(targetVal);
      if (fromIdx === -1 || toIdx === -1) return;
      list.splice(fromIdx, 1);
      list.splice(toIdx, 0, draggingValue);
      persistMasterData((prev) => ({
        ...prev,
        namesByCategory: { ...prev.namesByCategory, [drillCategory]: list },
      }));
    }
    setDraggingValue(null);
  };

  const handleSyncToServer = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      await api.saveMasterData(customMasterData);
      const updatedNames = await onUpdateInventory(inventory, [], [], true);
      if (updatedNames === null) {
        setSyncResult('동기화에 실패했습니다. 오류 안내를 확인해 주세요.');
        return;
      }
      // 전체 품목 재고 재계산 (기존 수불 이력의 snapshot/currentStock 정합화)
      const recalc = await api.recalculateAllStock();
      const nameCount = typeof updatedNames === 'number' ? updatedNames : 0;
      setSyncResult(
        `동기화 완료: 품명 갱신 ${nameCount}건, 재고 재계산 ${recalc.total}개 품목 처리.`
      );
      ActionLogger.log('MasterData Synced + Stock Recalculated');
    } catch (error) {
      console.error('Failed to sync master data:', error);
      setSyncResult('동기화에 실패했습니다. 오류 안내를 확인해 주세요.');
    } finally {
      setIsSyncing(false);
    }
  };

  const executeZoneItemSync = async () => {
    if (!pendingZoneSync || isSyncingZoneItems) return;
    const plan = pendingZoneSync;
    setPendingZoneSync(null);
    setIsSyncingZoneItems(true);
    setZoneSyncResult(null);
    try {
      const succeeded = await onNormalizeZoneItems(plan.inventory, plan.masterData);
      if (!succeeded) {
        setZoneSyncResult('동기화에 실패했습니다. 오류 안내를 확인해 주세요.');
        return;
      }
      setCustomMasterData(plan.masterData);
      onMasterDataChange(plan.masterData);
      setZoneSyncResult(
        plan.totalAdded > 0
          ? `공통 품목 동기화 완료: ${plan.totalAdded}개 품목을 현재고 0으로 보충했습니다.`
          : '공통 품목 기준정보 동기화 완료: 추가된 재고 품목은 없습니다.'
      );
      ActionLogger.log('ZONE Shared Item Sync', {
        additionsByCategory: plan.additionsByCategory,
        totalAdded: plan.totalAdded,
      });
    } catch (error) {
      console.error('Failed to sync shared ZONE items:', error);
      setZoneSyncResult('동기화에 실패했습니다. 오류 안내를 확인해 주세요.');
    } finally {
      setIsSyncingZoneItems(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Box size={20} className="text-orange-500" />
                ZONE(대분류) 및 기준정보 관리
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ZONE 별칭 변경(이력 유지), 목표 생산수량(2차 선반영), 품목 정렬 순서를 일괄 관리합니다.
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
            <div className="flex gap-1">
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTabKey(tab.key);
                    setDrillCategory(null);
                    setEditingValue(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                    drillCategory === null && activeTabKey === tab.key
                      ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {(effectiveTabKey === 'category' || effectiveTabKey === 'name') && (
              <button
                onClick={() => setIsOrderMode(!isOrderMode)}
                className={`mb-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                  isOrderMode
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {isOrderMode ? '순서 변경 완료' : '드래그 순서 변경'}
              </button>
            )}
          </div>

          {/* Drilldown Breadcrumb & Quick Add */}
          <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {drillCategory ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setDrillCategory(null);
                    setEditingValue(null);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  <ChevronLeft size={14} /> ZONE 목록
                </button>
                <span className="text-sm font-black text-orange-600 dark:text-orange-400">{drillCategory}</span>
                <span className="text-xs text-slate-400">소속 품목 ({dataEntries.length}종)</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                총 {dataEntries.length}개 항목 {effectiveTabKey === 'category' && '· ZONE명을 클릭하면 소속 품목을 관리합니다.'}
              </span>
            )}

            {effectiveTabKey === 'category' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newCategoryValue}
                  disabled={isAddingCategory}
                  onChange={(e) => {
                    setNewCategoryValue(e.target.value);
                    setAddCategoryError('');
                    setAddCategoryResult('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void handleAddCategory()}
                  placeholder="신규 ZONE명 (예: ZONE19, Fluid16)"
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-60"
                />
                <button
                  onClick={() => { void handleAddCategory(); }}
                  disabled={isAddingCategory || !newCategoryValue.trim()}
                  className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={15} /> {isAddingCategory ? '품목 복사 중...' : 'ZONE 추가'}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  신규 ZONE 공통 품목 {commonItemTemplates.length}종 자동 등록
                </span>
                {addCategoryError && (
                  <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                    {addCategoryError}
                  </span>
                )}
                {addCategoryResult && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400" role="status">
                    {addCategoryResult}
                  </span>
                )}
              </div>
            )}

            {effectiveTabKey === 'name' && drillCategory && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={newNameInputRef}
                  type="text"
                  value={newNameValue}
                  disabled={isAddingSubName}
                  onChange={(e) => {
                    setNewNameValue(e.target.value);
                    if (addSubNameError) setAddSubNameError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubName()}
                  placeholder="신규 품명 추가"
                  aria-invalid={Boolean(addSubNameError)}
                  aria-describedby={addSubNameError ? 'add-sub-name-error' : undefined}
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-52"
                />
                <button
                  onClick={handleAddSubName}
                  disabled={isAddingSubName}
                  className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={15} /> {isAddingSubName ? '등록 중...' : '품목 추가'}
                </button>
                <button
                  onClick={openExistingItemPicker}
                  disabled={isAddingExistingItems || sourceZoneOptions.length === 0}
                  className="px-3 py-1.5 text-sm border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 font-bold rounded-lg flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="다른 ZONE에 있는 기존 품목을 선택해 현재 ZONE에만 추가합니다."
                >
                  <Box size={15} /> 기존 품목 선택 추가
                </button>
              </div>
            )}
          </div>
          {addSubNameError && (
            <p id="add-sub-name-error" className="px-6 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100" role="alert">
              {addSubNameError}
            </p>
          )}
          {existingItemResult && drillCategory && (
            <p className="px-6 py-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900" role="status">
              {existingItemResult}
            </p>
          )}

          {/* List Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-2">
            {dataEntries.map(([val, count]) => {
              const isEditing = editingValue === val;
              const zoneMeta = effectiveTabKey === 'category' ? getZoneMetaForName(val) : null;

              return (
                <div
                  key={val}
                  draggable={isOrderMode}
                  onDragStart={() => isOrderMode && setDraggingValue(val)}
                  onDragOver={(e) => isOrderMode && e.preventDefault()}
                  onDrop={() => isOrderMode && handleDrop(val)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border transition-colors ${
                    draggingValue === val
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOrderMode && <GripVertical size={16} className="text-slate-400 cursor-grab shrink-0" />}

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && requestUpdate(val, tempValue)}
                          className="px-2.5 py-1 text-sm border border-orange-400 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => requestUpdate(val, tempValue)}
                          className="px-2.5 py-1 text-xs bg-orange-600 text-white rounded font-bold flex items-center gap-1"
                        >
                          <Save size={13} /> 적용
                        </button>
                        <button
                          onClick={() => setEditingValue(null)}
                          className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded text-slate-500"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                        {effectiveTabKey === 'category' ? (
                          <button
                            onClick={() => setDrillCategory(val)}
                            className="font-bold text-orange-700 dark:text-orange-400 hover:underline text-left flex items-center gap-1"
                          >
                            {val}
                            <ArrowRight size={13} className="opacity-50" />
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{val}</span>
                        )}

                        <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {count}품목
                        </span>

                        {zoneMeta?.plannedProductionQty ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 flex items-center gap-1">
                            <Factory size={11} /> {zoneMeta.plannedProductionQty.toLocaleString('ko-KR')}대
                          </span>
                        ) : null}

                        {zoneMeta?.customer && (
                          <span className="text-xs text-slate-400">({zoneMeta.customer})</span>
                        )}

                        {zoneMeta?.aliasHistory && zoneMeta.aliasHistory.length > 0 && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            이전명: {zoneMeta.aliasHistory[0].name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!isEditing && !isOrderMode && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {effectiveTabKey === 'category' && zoneMeta && (
                        <button
                          onClick={() => setZoneMetaTarget({ name: val, meta: zoneMeta })}
                          className="px-2.5 py-1 text-xs font-bold text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center gap-1"
                          title="ZONE 별칭 변경 / 고객사 / 목표 생산수량 설정"
                        >
                          <Sliders size={13} /> 별칭·설정
                        </button>
                      )}

                      {effectiveTabKey === 'name' && drillCategory && categoryOptions.length > 1 && (
                        <div className="flex items-center gap-1">
                          <select
                            value={moveTargets[val] || ''}
                            onChange={(e) => setMoveTargets({ ...moveTargets, [val]: e.target.value })}
                            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <option value="">ZONE 이동...</option>
                            {categoryOptions
                              .filter((c) => c !== drillCategory)
                              .map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                          </select>
                          {moveTargets[val] && (
                            <button
                              onClick={() => requestMoveSubcategory(val, moveTargets[val])}
                              className="px-2 py-1 text-xs bg-orange-600 text-white rounded font-bold"
                            >
                              이동
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          // 재고 유무와 관계없이 전체수정모달(StockForm)로 통일
                          if (onEditItem && drillCategory) {
                            // namesByCategory의 품목명과 inventory의 name이 공백·대소문자 등으로
                            // 미묘하게 다를 수 있으므로 trim·소문자 정규화로 검색.
                            // 정규화 검색 실패 시에만 createDraftItem(신규)으로 처리하여
                            // 기존 재고 문서를 남겨둔 채 새 문서가 생기는 중복을 방지한다.
                            const normalizedVal = String(val || '').trim().toLocaleLowerCase();
                            const target = inventory.find(
                              (i) =>
                                i.category === drillCategory &&
                                String(i.name || '').trim().toLocaleLowerCase() === normalizedVal
                            );
                            onEditItem(target ? target.id : createDraftItem(drillCategory, val));
                            return;
                          }
                          setEditingValue(val);
                          setTempValue(val);
                        }}
                        className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded"
                        title="품목 정보 수정"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => requestDelete(val)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {dataEntries.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">등록된 기준정보가 없습니다.</div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSyncToServer}
                  disabled={isSyncing || isSyncingZoneItems}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-2 shadow disabled:opacity-50 shrink-0"
                >
                  <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? '동기화 중...' : '서버 즉시 동기화'}
                </button>
                <button
                  onClick={() => {
                    setZoneSyncResult(null);
                    setPendingZoneSync(zoneItemSyncPlan);
                  }}
                  disabled={
                    isSyncing ||
                    isSyncingZoneItems ||
                    !zoneItemSyncPlan.hasChanges ||
                    Boolean(zoneItemSyncPlan.validationMessage)
                  }
                  className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg flex items-center gap-2 shadow disabled:opacity-50 shrink-0"
                  title="모든 ZONE에 없는 품목 정의를 현재고 0으로 보충합니다."
                >
                  <Layers size={15} className={isSyncingZoneItems ? 'animate-pulse' : ''} />
                  {isSyncingZoneItems ? '품목 보충 중...' : `공통 품목 동기화 (${zoneItemSyncPlan.totalAdded})`}
                </button>
              </div>
              {zoneItemSyncPlan.validationMessage ? (
                <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {zoneItemSyncPlan.validationMessage}
                </span>
              ) : !zoneItemSyncPlan.hasChanges ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  모든 ZONE의 품목 수와 기준정보가 일치합니다.
                </span>
              ) : null}
              {syncResult && (
                <span className="text-xs text-slate-600 dark:text-slate-300" role="status">
                  {syncResult}
                </span>
              )}
              {zoneSyncResult && (
                <span className="text-xs text-slate-600 dark:text-slate-300" role="status">
                  {zoneSyncResult}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {zoneMetaTarget && (
        <ZoneMetaModal
          zoneName={zoneMetaTarget.name}
          initialMeta={zoneMetaTarget.meta}
          existingNames={categoryOptions}
          onSave={handleSaveZoneMeta}
          onClose={() => setZoneMetaTarget(null)}
        />
      )}

      {analysis && (
        <AnalysisConfirmModal
          analysis={analysis}
          onConfirm={executeAnalysis}
          onCancel={() => setAnalysis(null)}
        />
      )}
      {pendingZoneSync && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="zone-item-sync-title"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-orange-200 dark:border-orange-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200">
              <h3 id="zone-item-sync-title" className="font-bold">ZONE 공통 품목 동기화 확인</h3>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>
                {pendingZoneSync.totalAdded > 0 ? (
                  <>
                    모든 ZONE에서 사용하는 품목 정의를 맞추기 위해 누락된 품목
                    <strong className="text-orange-600 dark:text-orange-400"> {pendingZoneSync.totalAdded}개</strong>를 추가합니다.
                  </>
                ) : (
                  '현재고 품목은 이미 ZONE별로 일치합니다. 기준정보의 공통 품목명 목록을 동기화합니다.'
                )}
              </p>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 space-y-1">
                {Object.entries(pendingZoneSync.additionsByCategory)
                  .filter(([, count]) => count > 0)
                  .map(([category, count]) => (
                    <div key={category} className="flex justify-between gap-3">
                      <span>{category}</span>
                      <span className="font-semibold">
                        현재 {inventory.filter((item) => item.category === category).length}개
                        {' → '}{pendingZoneSync.countsByCategory[category]}개 (+{count})
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                새 품목은 현재고 0으로 생성하고 기존 품목·재고·수불 이력은 변경하지 않습니다.
                Excel 복구 원본은 변경하지 않습니다. 실행 전 별도 백업을 권장합니다.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setPendingZoneSync(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={() => { void executeZoneItemSync(); }}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow"
              >
                공통 품목 추가
              </button>
            </div>
          </div>
        </div>
      )}
      {showSubNameScopePrompt && drillCategory && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-item-scope-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 id="master-item-scope-title" className="font-bold text-slate-900 dark:text-white">
                다른 대분류에도 품목을 추가할까요?
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                “{newNameValue.trim()}”을(를) {drillCategory} 외 대분류에도 현재고 0으로 등록할지 선택해 주세요.
              </p>
            </div>
            <div className="p-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowSubNameScopePrompt(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300"
              >
                취소
              </button>
              <button
                onClick={() => { void confirmAddSubName(false); }}
                className="px-4 py-2 rounded-lg border border-orange-300 dark:border-orange-700 text-sm font-semibold text-orange-700 dark:text-orange-300"
              >
                {drillCategory}만 추가
              </button>
              <button
                onClick={() => { void confirmAddSubName(true); }}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-sm font-bold text-white"
              >
                전체 대분류에 추가
              </button>
            </div>
          </div>
        </div>
      )}
      {showExistingItemPicker && drillCategory && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="existing-zone-items-title"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 id="existing-zone-items-title" className="font-bold text-slate-900 dark:text-white">
                {drillCategory}에 기존 품목 선택 추가
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                다른 ZONE의 품목 정의만 복사합니다. 현재고·적정재고는 0으로 시작하고 수불 이력은 복사하지 않습니다.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  품목 원본 ZONE
                  <select
                    value={selectedSourceZone}
                    onChange={(event) => {
                      setSourceZone(event.target.value);
                      setSelectedExistingItemKeys(new Set());
                      setExistingItemError('');
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    {sourceZoneOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  품목 검색
                  <input
                    value={existingItemSearch}
                    onChange={(event) => setExistingItemSearch(event.target.value)}
                    placeholder="품명, 도금, 규격"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>대상: {drillCategory}</span>
                <span>
                  선택 {selectedExistingItemKeys.size}개 / 추가 가능 {availableExistingItems.length}개
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {availableExistingItems.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    선택한 원본 ZONE에 추가할 수 있는 품목이 없습니다.
                  </p>
                ) : (
                  availableExistingItems.map((item) => {
                    const key = getItemDefinitionKey(item);
                    const checked = selectedExistingItemKeys.has(key);
                    return (
                      <label
                        key={key}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedExistingItemKeys((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                          className="mt-1 accent-orange-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item.name}
                          </span>
                          <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {[item.plating, item.spec].filter(Boolean).join(' · ') || '도금/규격 정보 없음'}
                            {' · '}{item.unit || 'EA'}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {existingItemError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {existingItemError}
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setShowExistingItemPicker(false)}
                disabled={isAddingExistingItems}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={() => { void handleAddSelectedExistingItems(); }}
                disabled={isAddingExistingItems || selectedExistingItemKeys.size === 0}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingExistingItems ? '추가 중...' : `선택 품목 ${selectedExistingItemKeys.size}개 추가`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MasterDataManagerModal;
