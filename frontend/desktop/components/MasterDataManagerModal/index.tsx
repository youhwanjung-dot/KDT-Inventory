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
} from 'lucide-react';
import { InventoryItem, MasterData, ZoneMeta } from '../../types';
import { ActionLogger } from '../../utils/logger';
import { api } from '../../utils/api';
import { AnalysisResult, MasterDataManagerModalProps, TAB_CONFIG, TargetField } from './types';
import ZoneMetaModal from './ZoneMetaModal';
import AnalysisConfirmModal from './AnalysisConfirmModal';

const MasterDataManagerModal: React.FC<MasterDataManagerModalProps> = ({
  inventory,
  masterData: masterDataProp,
  onMasterDataChange,
  onUpdateInventory,
  onCreateItem,
  onClose,
}) => {
  const [activeTabKey, setActiveTabKey] = useState<TargetField>('category');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [zoneMetaTarget, setZoneMetaTarget] = useState<{ name: string; meta: ZoneMeta } | null>(null);

  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [newNameValue, setNewNameValue] = useState('');
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [draggingValue, setDraggingValue] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const pendingChangedRef = useRef<InventoryItem[]>([]);
  const pendingDeleteIdsRef = useRef<string[]>([]);

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

  const effectiveTabKey: TargetField = drillCategory !== null ? 'name' : activeTabKey;

  const categoryOptions = useMemo(() => {
    const fromInv = inventory.map((i) => i.category).filter(Boolean);
    const ordered = [...(customMasterData.categories || [])];
    fromInv.forEach((c) => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }, [inventory, customMasterData.categories]);

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
  const handleAddCategory = () => {
    const trimmed = newCategoryValue.trim();
    if (!trimmed || categoryOptions.includes(trimmed)) return;
    const newZoneId = `Z-${Date.now().toString(36).toUpperCase()}`;
    persistMasterData((prev) => ({
      ...prev,
      categories: [...prev.categories, trimmed],
      namesByCategory: { ...prev.namesByCategory, [trimmed]: prev.namesByCategory[trimmed] || [] },
      zoneMeta: {
        ...(prev.zoneMeta || {}),
        [newZoneId]: { zoneId: newZoneId, displayName: trimmed, aliasHistory: [] },
      },
    }));
    setNewCategoryValue('');
    ActionLogger.log('ZONE Created', { zone: trimmed, zoneId: newZoneId });
  };

  // Add new item name inside drilled ZONE
  const handleAddSubName = () => {
    if (!drillCategory) return;
    const trimmed = newNameValue.trim();
    if (!trimmed) return;
    persistMasterData((prev) => {
      const existing = prev.namesByCategory[drillCategory] || [];
      if (existing.includes(trimmed)) return prev;
      return {
        ...prev,
        namesByCategory: { ...prev.namesByCategory, [drillCategory]: [...existing, trimmed] },
        nameOrder: prev.nameOrder.includes(trimmed) ? prev.nameOrder : [...prev.nameOrder, trimmed],
      };
    });
    if (onCreateItem) onCreateItem(drillCategory, trimmed);
    setNewNameValue('');
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
    setAnalysis({
      type: effectiveTabKey === 'name' ? 'DELETE_SUBCATEGORY' : 'DELETE',
      field: effectiveTabKey,
      targetValue,
      newValue: '',
      affectedCount: affected.length,
      affectedSample: affected.slice(0, 8).map((i) => `[${i.category}] ${i.name} ${i.spec || ''}`),
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
    try {
      await api.saveMasterData(customMasterData);
      if (pendingChangedRef.current.length > 0 || pendingDeleteIdsRef.current.length > 0) {
        onUpdateInventory(inventory, pendingChangedRef.current, pendingDeleteIdsRef.current);
        pendingChangedRef.current = [];
        pendingDeleteIdsRef.current = [];
      }
      ActionLogger.log('MasterData Synced');
    } finally {
      setIsSyncing(false);
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
                <Box size={20} className="text-indigo-500" />
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
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
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
                    ? 'bg-indigo-600 text-white border-indigo-600'
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDrillCategory(null);
                    setEditingValue(null);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  <ChevronLeft size={14} /> ZONE 목록
                </button>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{drillCategory}</span>
                <span className="text-xs text-slate-400">소속 품목 ({dataEntries.length}종)</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                총 {dataEntries.length}개 항목 {effectiveTabKey === 'category' && '· ZONE명을 클릭하면 소속 품목을 관리합니다.'}
              </span>
            )}

            {effectiveTabKey === 'category' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryValue}
                  onChange={(e) => setNewCategoryValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="신규 ZONE명 (예: ZONE19, Fluid16)"
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-60"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1"
                >
                  <Plus size={15} /> ZONE 추가
                </button>
              </div>
            )}

            {effectiveTabKey === 'name' && drillCategory && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newNameValue}
                  onChange={(e) => setNewNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubName()}
                  placeholder="신규 품명 추가"
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-52"
                />
                <button
                  onClick={handleAddSubName}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1"
                >
                  <Plus size={15} /> 품목 추가
                </button>
              </div>
            )}
          </div>

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
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
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
                          className="px-2.5 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => requestUpdate(val, tempValue)}
                          className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded font-bold flex items-center gap-1"
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
                            className="font-bold text-indigo-700 dark:text-indigo-400 hover:underline text-left flex items-center gap-1"
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
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1">
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
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
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
                              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded font-bold"
                            >
                              이동
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setEditingValue(val);
                          setTempValue(val);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="이름 수정"
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
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={handleSyncToServer}
              disabled={isSyncing}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-2 shadow disabled:opacity-50"
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? '동기화 중...' : '서버 즉시 동기화'}
            </button>
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
    </>
  );
};

export default MasterDataManagerModal;
