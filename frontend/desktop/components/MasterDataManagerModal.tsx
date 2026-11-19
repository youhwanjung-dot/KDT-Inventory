import React, { useState, useMemo, useRef } from 'react';
import { X, Tag, Box, Edit2, Trash2, ArrowRight, AlertTriangle, CheckCircle, Save, Info, Package, MapPin, Archive, FileText, Component, Layers, GripVertical, RefreshCw, CloudOff } from 'lucide-react';
import { InventoryItem, MasterData } from '../types';
import { ActionLogger } from '../utils/logger';
import { api } from '../utils/api';

interface MasterDataManagerModalProps {
  inventory: InventoryItem[];
  masterData: MasterData;
  onMasterDataChange: (md: MasterData) => void;
  onUpdateInventory: (newInventory: InventoryItem[], changedItems: InventoryItem[], deleteItemIds?: string[]) => void;
  onCreateItem?: (category: string, name: string) => void;
  onClose: () => void;
}

type TargetField = keyof Omit<InventoryItem, 'id' | 'lastUpdated' | 'currentStock' | 'safeStock'>;

interface TabConfig {
  key: TargetField;
  label: string;
  icon: React.ReactNode;
  fallback: string; // Default text to show when value is empty
}

const TAB_CONFIG: TabConfig[] = [
  { key: 'category', label: '카테고리', icon: <Tag size={16} />, fallback: '기타' },
  { key: 'unit', label: '단위 (Unit)', icon: <Component size={16} />, fallback: '(단위 없음)' },
  { key: 'location', label: '보관장소', icon: <MapPin size={16} />, fallback: '(장소 미지정)' },
  { key: 'supplier', label: '사용부서', icon: <Archive size={16} />, fallback: '(부서 미지정)' },
];

interface AnalysisResult {
  type: 'UPDATE' | 'DELETE' | 'MOVE_SUBCATEGORY' | 'DELETE_SUBCATEGORY';
  field: TargetField;
  targetValue: string;
  newValue: string;
  affectedCount: number;
  affectedSample: string[]; // Names of items affected
  moveSourceCategories?: string[];
}

const MasterDataManagerModal: React.FC<MasterDataManagerModalProps> = ({ inventory, masterData: masterDataProp, onMasterDataChange, onUpdateInventory, onCreateItem, onClose }) => {
  const [activeTabKey, setActiveTabKey] = useState<TargetField>('category');
  // drillCategory: null = 대분류 목록, string = 해당 대분류의 소분류 목록
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // 변경 이력 추적
  const changeLogRef = useRef<string[]>([]);

  // Firestore에서 받은 데이터를 그대로 초기화 (인벤토리 주입 없음)
  const [customMasterData, setCustomMasterData] = useState<{
    categories: string[];
    namesByCategory: Record<string, string[]>;
    nameOrder: string[];
  }>({
    categories: masterDataProp.categories,
    namesByCategory: masterDataProp.namesByCategory,
    nameOrder: masterDataProp.nameOrder,
  });

  // 1회성 마이그레이션: Firestore에 namesByCategory가 없으면 인벤토리에서 빌드하고 즉시 저장
  // 이후 모달이 열릴 때는 Firestore의 데이터를 사용 (인벤토리 루프 없음)
  React.useEffect(() => {
    const hasNamesByCategory = Object.keys(masterDataProp.namesByCategory).some(
      k => (masterDataProp.namesByCategory[k] || []).length > 0
    );
    if (!hasNamesByCategory && inventory.length > 0) {
      // Firestore에 저장된 sobriety namesByCategory가 없으면 인벤토리에서 1회 빌드
      const builtNamesByCategory: Record<string, string[]> = {};
      inventory.forEach(item => {
        const cat = (item.category || '').trim();
        const name = (item.name || '').trim();
        if (!cat || !name) return;
        if (!builtNamesByCategory[cat]) builtNamesByCategory[cat] = [];
        if (!builtNamesByCategory[cat].includes(name)) builtNamesByCategory[cat].push(name);
      });
      const builtCategories = masterDataProp.categories.length > 0
        ? masterDataProp.categories
        : Array.from(new Set(inventory.map(i => (i.category || '').trim()).filter(Boolean)));
      const builtNameOrder = masterDataProp.nameOrder.length > 0
        ? masterDataProp.nameOrder
        : Array.from(new Set(inventory.map(i => (i.name || '').trim()).filter(Boolean)));
      const migrated = { categories: builtCategories, namesByCategory: builtNamesByCategory, nameOrder: builtNameOrder };
      // Firestore에 즉시 저장 (이후 이 로직은 실행되지 않음)
      api.saveMasterData(migrated).catch(err => console.error('[MasterData Migration] 저장 실패:', err));
      setCustomMasterData(migrated);
      onMasterDataChange(migrated);
    }
  }, []); // 모달 오픈 시 1회만 실행

  // [Ver5.3.0 FIX] 드릴다운 진입 시 inventory에는 있지만 masterData에 없는
  // 소분류(신규등록 경로로 추가된 품목)를 자동으로 masterData에 동기화
  React.useEffect(() => {
    if (drillCategory === null) return;

    const existingNames = customMasterData.namesByCategory[drillCategory] || [];
    const inventoryNamesInCat = inventory
      .filter(item => item.category === drillCategory)
      .map(item => (item.name || '').trim())
      .filter(Boolean);

    const missingNames = inventoryNamesInCat.filter(n => !existingNames.includes(n));
    if (missingNames.length === 0) return;

    // 누락 항목을 masterData에 추가 (Firestore 저장)
    updateCustomMasterData(prev => {
      const currentNames = prev.namesByCategory[drillCategory] || [];
      const newNames = Array.from(new Set([...currentNames, ...missingNames]));
      const newNameOrder = Array.from(new Set([...prev.nameOrder, ...missingNames]));
      return {
        ...prev,
        namesByCategory: { ...prev.namesByCategory, [drillCategory]: newNames },
        nameOrder: newNameOrder,
      };
    });

    console.info(`[MasterData Sync] 드릴다운 자동 동기화: ${drillCategory} → +${missingNames.join(', ')}`);
  }, [drillCategory]); // drillCategory 변경 시 실행

  // NOTE: masterData→inventory 자동 동기화는 이동/삭제 등 명시적 조작시에만 수행
  // (useEffect로 모달 오픈 시 자동 실행하면 migration과 충돌 가능성 있음 → 안전상 비활성화)

  const [newCategoryValue, setNewCategoryValue] = useState<string>('');
  const [newNameValue, setNewNameValue] = useState<string>('');
  const [newNameCategory, setNewNameCategory] = useState<string>('');
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [draggingValue, setDraggingValue] = useState<string | null>(null);

  // 소분류 뷰에 있을 때는 activeTabKey를 'name'으로 간주
  const effectiveTabKey: TargetField = drillCategory !== null ? 'name' : activeTabKey;

  // activeTabConfig: drillCategory 중일 때는 name 탭 코마로 간주
  const activeTabConfig = useMemo(() => {
    if (drillCategory !== null) {
      return { key: 'name' as TargetField, label: '소분류(품목명)', icon: <Box size={16} />, fallback: '(이름 미지정)' };
    }
    return TAB_CONFIG.find(t => t.key === activeTabKey) || TAB_CONFIG[0];
  }, [activeTabKey, drillCategory]);

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    customMasterData.categories.forEach((value, index) => {
      map.set(value, index);
    });
    return map;
  }, [customMasterData]);

  const nameOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    customMasterData.nameOrder.forEach((value, index) => {
      map.set(value, index);
    });
    return map;
  }, [customMasterData]);

  const categoryOptions = useMemo(() => {
    const fromInventory = inventory.map(i => i.category).filter(Boolean);
    const custom = customMasterData.categories || [];
    return Array.from(new Set([...fromInventory, ...custom])).sort((a, b) => {
      const orderA = categoryOrderMap.get(a);
      const orderB = categoryOrderMap.get(b);
      if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
        return orderA - orderB;
      }
      if (orderA !== undefined && orderB === undefined) return -1;
      if (orderA === undefined && orderB !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [inventory, customMasterData, categoryOrderMap]);

  const allCustomNames = useMemo(() => {
    const values = Object.values(customMasterData.namesByCategory || {}).flat();
    return Array.from(new Set(values));
  }, [customMasterData]);

  const getCategoriesForName = (name: string) => {
    const fromInventory = inventory.filter(i => i.name === name).map(i => i.category).filter(Boolean);
    const fromCustom = Object.entries(customMasterData.namesByCategory || {})
      .filter(([, names]) => names.includes(name))
      .map(([category]) => category);
    return Array.from(new Set([...fromInventory, ...fromCustom])).sort();
  };

  // --- Data Aggregation ---
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();

    if (effectiveTabKey === 'category') {
      customMasterData.categories.forEach(value => map.set(value, 0));
      inventory.forEach(item => {
        const val = String(item.category || '');
        if (val) map.set(val, (map.get(val) || 0) + 1);
      });
      const entries = Array.from(map.entries());
      return entries
        .sort((a, b) => {
          const orderA = categoryOrderMap.get(a[0]);
          const orderB = categoryOrderMap.get(b[0]);
          if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;
          if (orderA !== undefined && orderB === undefined) return -1;
          if (orderA === undefined && orderB !== undefined) return 1;
          return a[0].localeCompare(b[0]);
        })
        .map(([value, count]) => ({ value, count }));
    }

    if (effectiveTabKey === 'name' && drillCategory !== null) {
      // 드릴다운: masterData 기준 소분류를 시드 (순서 보장)
      const namesInCat = customMasterData.namesByCategory[drillCategory] || [];
      namesInCat.forEach(value => map.set(value, 0));

      // inventory에서 실제 등록된 품목 카운트
      // [Ver5.3.0 FIX] map.has() 조건 제거 → masterData에 없는 품목도 표시
      inventory.forEach(item => {
        if (item.category === drillCategory) {
          const val = String(item.name || '');
          if (val) {
            map.set(val, (map.get(val) || 0) + 1);
          }
        }
      });

      const catNameOrderMap = new Map<string, number>(namesInCat.map((n, i) => [n, i]));
      return Array.from(map.entries())
        .sort((a, b) => {
          const orderA = catNameOrderMap.get(a[0]);
          const orderB = catNameOrderMap.get(b[0]);
          if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
          if (orderA !== undefined) return -1;
          if (orderB !== undefined) return 1;
          return a[0].localeCompare(b[0]);
        })
        .map(([value, count]) => ({ value, count }));
    }

    // 기타 탭 (unit, location, supplier)
    inventory.forEach(item => {
      const val = String(item[effectiveTabKey] || '');
      map.set(val, (map.get(val) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }, [inventory, effectiveTabKey, drillCategory, customMasterData, isOrderMode, categoryOrderMap, nameOrderMap]);

  // --- Handlers ---

  const handleStartEdit = (value: string) => {
    setEditingValue(value);
    setTempValue(value);
  };

  const handleCancelEdit = () => {
    setEditingValue(null);
    setTempValue('');
  };

  const reorderValues = (values: string[], sourceValue: string, targetValue: string) => {
    const fromIndex = values.indexOf(sourceValue);
    const toIndex = values.indexOf(targetValue);
    if (fromIndex < 0 || toIndex < 0) return values;
    const next = [...values];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, sourceValue);
    return next;
  };

  const applyOrderUpdate = (orderedValues: string[]) => {
    if (effectiveTabKey === 'category') {
      updateCustomMasterData(prev => ({
        ...prev,
        categories: normalizeList(orderedValues)
      }));
      // NOTE: updateCustomMasterData가 Firestore에 저장하므로 migration 호요 없음
      return;
    }
    if (effectiveTabKey === 'name' && drillCategory !== null) {
      // 대분류별 소분류 순서 업데이트 + 글로벌 nameOrder 동기화
      updateCustomMasterData(prev => {
        const nextNamesByCategory = {
          ...prev.namesByCategory,
          [drillCategory]: normalizeList(orderedValues)
        };
        // nameOrder를 categories 순서대로 namesByCategory를 연결하여 재구축
        const rebuiltNameOrder: string[] = [];
        prev.categories.forEach(cat => {
          (nextNamesByCategory[cat] || []).forEach(name => {
            if (!rebuiltNameOrder.includes(name)) {
              rebuiltNameOrder.push(name);
            }
          });
        });
        // namesByCategory에 없는 기존 nameOrder 항목도 유지
        prev.nameOrder.forEach(name => {
          if (!rebuiltNameOrder.includes(name)) {
            rebuiltNameOrder.push(name);
          }
        });
        return {
          ...prev,
          namesByCategory: nextNamesByCategory,
          nameOrder: rebuiltNameOrder
        };
      });
      // NOTE: updateCustomMasterData가 Firestore에 저장하므로 migration 호출 불필요
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLTableRowElement>, value: string) => {
    if (!isOrderMode) return;
    setDraggingValue(value);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', value);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>) => {
    if (!isOrderMode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggingValue(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLTableRowElement>, targetValue: string) => {
    if (!isOrderMode) return;
    event.preventDefault();
    const sourceValue = draggingValue || event.dataTransfer.getData('text/plain');
    if (!sourceValue || sourceValue === targetValue) return;
    const values = dataMap.map(row => row.value);
    const nextOrder = reorderValues(values, sourceValue, targetValue);
    applyOrderUpdate(nextOrder);
    setDraggingValue(null);
  };

  const updateCustomMasterData = (updater: (prev: { categories: string[]; namesByCategory: Record<string, string[]>; nameOrder: string[] }) => { categories: string[]; namesByCategory: Record<string, string[]>; nameOrder: string[] }) => {
    setCustomMasterData(prev => {
      const next = updater(prev);
      // Propagate to parent (App root state)
      onMasterDataChange(next);
      // Save to Firestore (Cloud Function) - async, fire-and-forget with error logging
      api.saveMasterData(next).catch(err => {
        console.error('Failed to save master data to cloud:', err);
      });
      return next;
    });
  };

  const normalizeList = (items: string[]) => Array.from(new Set(items.map(i => i.trim()).filter(Boolean)));

  const applyCustomMasterData = (result: AnalysisResult) => {
    updateCustomMasterData(prev => {
      const next = {
        categories: [...prev.categories],
        namesByCategory: { ...prev.namesByCategory },
        nameOrder: [...prev.nameOrder]
      };

      if (result.type === 'UPDATE') {
        if (result.field === 'category') {
          next.categories = normalizeList(next.categories.map(c => c === result.targetValue ? result.newValue : c));
          if (next.namesByCategory[result.targetValue]) {
            const names = next.namesByCategory[result.targetValue];
            delete next.namesByCategory[result.targetValue];
            next.namesByCategory[result.newValue] = normalizeList([...(next.namesByCategory[result.newValue] || []), ...names]);
          }
        }
        if (result.field === 'name') {
          Object.keys(next.namesByCategory).forEach(category => {
            next.namesByCategory[category] = normalizeList(next.namesByCategory[category].map(n => n === result.targetValue ? result.newValue : n));
          });
          next.nameOrder = normalizeList(next.nameOrder.map(n => n === result.targetValue ? result.newValue : n));
        }
      }

      if (result.type === 'DELETE') {
        if (result.field === 'category') {
          // 대분류 삭제: namesByCategory에서 완전히 제거 (기타로 이동 없음)
          next.categories = normalizeList(next.categories.filter(c => c !== result.targetValue));
          delete next.namesByCategory[result.targetValue];
        }
        if (result.field === 'name') {
          Object.keys(next.namesByCategory).forEach(category => {
            next.namesByCategory[category] = normalizeList(next.namesByCategory[category].filter(n => n !== result.targetValue));
          });
          next.nameOrder = normalizeList(next.nameOrder.filter(n => n !== result.targetValue));
        }
      }

      if (result.type === 'DELETE_SUBCATEGORY') {
        // 소분류 삭제: 마스터데이터에서 제거 + 인벤토리도 applyChanges에서 실제 삭제됨
        const parentCategory = result.newValue; // newValue에 대분류 이름 저장
        if (parentCategory && next.namesByCategory[parentCategory]) {
          next.namesByCategory[parentCategory] = normalizeList(
            next.namesByCategory[parentCategory].filter(n => n !== result.targetValue)
          );
        }
        next.nameOrder = normalizeList(next.nameOrder.filter(n => n !== result.targetValue));
      }

      if (result.type === 'MOVE_SUBCATEGORY') {
        const targetName = result.targetValue;
        const destCategory = result.newValue;
        next.categories = normalizeList([...next.categories, destCategory]);
        Object.keys(next.namesByCategory).forEach(category => {
          next.namesByCategory[category] = normalizeList(next.namesByCategory[category].filter(n => n !== targetName));
        });
        next.namesByCategory[destCategory] = normalizeList([...(next.namesByCategory[destCategory] || []), targetName]);
        // nameOrder를 categories 순서대로 namesByCategory를 연결하여 재구축
        const rebuiltNameOrder: string[] = [];
        next.categories.forEach(cat => {
          (next.namesByCategory[cat] || []).forEach(name => {
            if (!rebuiltNameOrder.includes(name)) {
              rebuiltNameOrder.push(name);
            }
          });
        });
        next.nameOrder.forEach(name => {
          if (!rebuiltNameOrder.includes(name)) {
            rebuiltNameOrder.push(name);
          }
        });
        next.nameOrder = rebuiltNameOrder;
      }

      return next;
    });
  };

  const handleAddCategory = () => {
    const value = newCategoryValue.trim();
    if (!value) return;
    updateCustomMasterData(prev => ({
      ...prev,
      categories: normalizeList([...prev.categories, value])
    }));
    changeLogRef.current.push(`[추가] 대분류 "${value}"`);
    setNewCategoryValue('');
  };

  const handleAddName = () => {
    const name = newNameValue.trim();
    // 드릴다운 상태이면 drillCategory 우선 사용, 아니면 newNameCategory 사용
    const category = (drillCategory || newNameCategory).trim();
    if (!name || !category) return;
    updateCustomMasterData(prev => ({
      categories: normalizeList([...prev.categories, category]),
      namesByCategory: {
        ...prev.namesByCategory,
        [category]: normalizeList([...(prev.namesByCategory[category] || []), name])
      },
      nameOrder: normalizeList([...(prev.nameOrder || []), name])
    }));
    changeLogRef.current.push(`[추가] 소분류 "${name}" → ${category}`);
    setNewNameValue('');
    // Auto-create inventory item + carryover transaction
    if (onCreateItem) {
      onCreateItem(category, name);
    }
  };

  const handleRequestMove = (name: string, targetCategory: string) => {
    if (!targetCategory) return;
    const affectedItems = inventory.filter(item => item.name === name);
    setAnalysis({
      type: 'MOVE_SUBCATEGORY',
      field: 'category',
      targetValue: name,
      newValue: targetCategory,
      affectedCount: affectedItems.length,
      affectedSample: affectedItems.slice(0, 5).map(i => i.name),
      moveSourceCategories: getCategoriesForName(name)
    });
  };

  const handleRequestUpdate = () => {
    if (editingValue === null) return;
    const newVal = tempValue.trim();

    if (editingValue === newVal) {
      handleCancelEdit();
      return;
    }

    const targetVal = editingValue;
    // effectiveTabKey를 사용하여 소분류 드릴다운 시에도 올바른 필드로 수정
    const fieldKey = effectiveTabKey;

    // Analyze Impact
    const affectedItems = inventory.filter(item =>
      String(item[fieldKey] || '') === targetVal
    );

    setAnalysis({
      type: 'UPDATE',
      field: fieldKey,
      targetValue: targetVal,
      newValue: newVal,
      affectedCount: affectedItems.length,
      affectedSample: affectedItems.slice(0, 5).map(i => i.name)
    });
  };

  const handleRequestDelete = (value: string) => {
    // 소분류 드릴다운 중에 삭제하면 → 마스터데이터에서만 제거 (인벤토리 변경 없음)
    if (drillCategory !== null) {
      const affectedItems = inventory.filter(item => item.name === value && item.category === drillCategory);
      setAnalysis({
        type: 'DELETE_SUBCATEGORY',
        field: 'name',
        targetValue: value,
        newValue: drillCategory, // 부모 대분류 저장
        affectedCount: affectedItems.length,
        affectedSample: affectedItems.slice(0, 3).map(i => i.name)
      });
      return;
    }

    // 일반 탭 (대분류, 단위, 보관장소, 사용부서) 삭제
    const affectedItems = inventory.filter(item =>
      String(item[activeTabKey] || '') === value
    );
    let fallback = '';
    // 대분류/소분류 삭제 시 '기타'로 이동하지 않고 실제 삭제됨 (fallback 없음)

    setAnalysis({
      type: 'DELETE',
      field: activeTabKey,
      targetValue: value,
      newValue: fallback,
      affectedCount: affectedItems.length,
      affectedSample: affectedItems.slice(0, 5).map(i => i.name)
    });
  };

  const applyChanges = () => {
    if (!analysis) return;

    const { type, field, targetValue, newValue } = analysis;

    // DELETE_SUBCATEGORY: 마스터데이터에서 제거 + 인벤토리에서도 실제 삭제
    if (type === 'DELETE_SUBCATEGORY') {
      const parentCategory = newValue; // newValue에 대분류 저장
      const itemsToDelete = inventory.filter(
        item => item.name === targetValue && item.category === parentCategory
      );
      const deleteIds = itemsToDelete.map(i => i.id);
      const newInventory = inventory.filter(item => !deleteIds.includes(item.id));
      onUpdateInventory(newInventory, [], deleteIds);
      applyCustomMasterData(analysis);
      ActionLogger.log('Master Data DELETE_SUBCATEGORY (Hard)', { name: targetValue, category: parentCategory, deleted: deleteIds.length });
      changeLogRef.current.push(`[삭제] 소분류 "${targetValue}" (${parentCategory}, ${deleteIds.length}개 품목)`);
      setAnalysis(null);
      setEditingValue(null);
      setTempValue('');
      return;
    }

    const updatedInventory = inventory.map(item => {
      if (type === 'MOVE_SUBCATEGORY') {
        if (item.name === targetValue) {
          return {
            ...item,
            category: newValue
          };
        }
        return item;
      }

      const currentValue = String(item[field] || '');
      if (currentValue === targetValue) {
        if (type === 'DELETE') {
          return null; // 삭제 대상 마킹
        }
        return {
          ...item,
          [field]: newValue
        };
      }
      return item;
    }).filter((item): item is InventoryItem => item !== null);

    // 대분류 DELETE: 삭제 대상 ID 수집
    const deleteItemIds: string[] = type === 'DELETE'
      ? inventory.filter(item => String(item[field] || '') === targetValue).map(i => i.id)
      : [];

    // Identify changed items for API persistence (DELETE는 제외)
    const changedItems = type === 'DELETE' ? [] : updatedInventory.filter(item => {
      const oldItem = inventory.find(i => i.id === item.id);
      if (!oldItem) return false;
      if (type === 'MOVE_SUBCATEGORY') {
        return oldItem.name === targetValue;
      }
      return String(oldItem[field] || '') === targetValue;
    });

    onUpdateInventory(updatedInventory, changedItems, deleteItemIds.length > 0 ? deleteItemIds : undefined);
    applyCustomMasterData(analysis);
    ActionLogger.log(`Master Data ${type}`, { field, from: targetValue, to: newValue });
    // 변경 이력 기록
    const actionLabels: Record<string, string> = { DELETE: '초기화', DELETE_SUBCATEGORY: '삭제', MOVE_SUBCATEGORY: '이동', UPDATE: '변경' };
    const actionLabel = actionLabels[type] || '변경';
    changeLogRef.current.push(`[${actionLabel}] ${targetValue}${newValue ? ` → ${newValue}` : ''} (${analysis.affectedCount}개 품목)`);

    // Reset States
    setAnalysis(null);
    setEditingValue(null);
    setTempValue('');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Box size={24} className="text-indigo-600 dark:text-indigo-400" />
              기준정보 일괄 관리(Admin)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              등록된 모든 데이터 필드를 일괄 수정하거나 삭제/초기화합니다. 지정한 대분류로 일괄 이동합니다.
            </p>
          </div>
          <button aria-label="Close" onClick={() => {
            if (changeLogRef.current.length > 0) {
              setShowSyncConfirm(true);
            } else {
              onClose();
            }
          }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs - Scrollable */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTabKey(tab.key); handleCancelEdit(); setIsOrderMode(false); setDrillCategory(null); }}
                className={`px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap transition-colors border-b-2 flex-shrink-0 ${activeTabKey === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 소분류 드릴다운: 브레드크럼 네비게이션 */}
        {drillCategory !== null && (
          <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2 text-sm">
            <button
              onClick={() => { setDrillCategory(null); setIsOrderMode(false); handleCancelEdit(); }}
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              <ArrowRight size={14} className="rotate-180" />
              카테고리
            </button>
            <span className="text-slate-400">/</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{drillCategory}</span>
            <span className="text-slate-400 text-xs ml-1">소분류 관리</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-900">

          {/* 카테고리 탭: 대분류 목록 뷰 */}
          {activeTabKey === 'category' && drillCategory === null && (
            <>
              {/* 더하기 영역 */}
              <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder="새로운 대분류 입력"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                  >
                    대분류 추가
                  </button>
                </div>
              </div>
              {/* 순서변경 버튼 */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => { handleCancelEdit(); setIsOrderMode(prev => !prev); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border ${isOrderMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                >
                  {isOrderMode ? '순서변경 완료' : '순서변경'}
                </button>
                {isOrderMode && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">드래그해서 대분류 순서를 변경하세요.</span>
                )}
              </div>
            </>
          )}

          {/* 카테고리 탭: 소분류 드릴다운 뷰 */}
          {activeTabKey === 'category' && drillCategory !== null && (
            <>
              {/* 소분류 주가 영역 */}
              <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newNameValue}
                    onChange={(e) => setNewNameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddName()}
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder={`[${drillCategory}] 소분류 입력`}
                  />
                  <button
                    onClick={handleAddName}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                  >
                    소분류 추가
                  </button>
                </div>
              </div>
              {/* 순서변경 버튼 */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => { handleCancelEdit(); setIsOrderMode(prev => !prev); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border ${isOrderMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                >
                  {isOrderMode ? '순서변경 완료' : '소분류 순서변경'}
                </button>
                {isOrderMode && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">드래그해서 [{drillCategory}] 소분류 순서를 변경하세요.</span>
                )}
              </div>
            </>
          )}

          {/* 다른 탭 (unit, location, supplier) 입력 영역 */}
          {activeTabKey !== 'category' && (
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => { handleCancelEdit(); setIsOrderMode(prev => !prev); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border ${isOrderMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'}`}
              >
                {isOrderMode ? '순서변경 완료' : '순서변경'}
              </button>
              {isOrderMode && (
                <span className="text-xs text-slate-500 dark:text-slate-400">드래그해서 순서를 변경하세요.</span>
              )}
            </div>
          )}

          {/* 테이블 */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase">
                <tr>
                  <th className="px-6 py-3">
                    {effectiveTabKey === 'category' ? '대분류' : effectiveTabKey === 'name' ? `소분류 (${drillCategory})` : '목록'}
                  </th>
                  <th className="px-6 py-3 w-24 text-center">품목 수</th>
                  <th className="px-6 py-3 w-40 text-center">관리</th>
                  {isOrderMode && (
                    <th className="px-4 py-3 w-16 text-center">순서</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {dataMap.map((row) => (
                  <tr
                    key={String(row.value)}
                    className={`transition-colors group ${isOrderMode ? 'cursor-move hover:bg-indigo-50/30 dark:hover:bg-slate-700/30' :
                      (effectiveTabKey === 'category' && !isOrderMode) ? 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20' :
                        'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    draggable={isOrderMode}
                    onDragStart={(event) => handleDragStart(event, String(row.value))}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(event) => handleDrop(event, String(row.value))}
                    onClick={() => {
                      // 대분류 행 전체 클릭 시 소분류로 드릴다운 (순서변경중 제외, 편집중 제외)
                      if (effectiveTabKey === 'category' && !isOrderMode && editingValue === null) {
                        setDrillCategory(row.value);
                        setIsOrderMode(false);
                        handleCancelEdit();
                      }
                    }}
                  >
                    <td className="px-6 py-3">
                      {editingValue === row.value ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <input
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="w-full px-3 py-1.5 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            autoFocus
                            placeholder="변경할 내용 입력"
                            title="변경할 내용 입력"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRequestUpdate(); }}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded shadow-sm"
                            title="변경 적용"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                            className="p-1.5 bg-slate-400 hover:bg-slate-500 text-white rounded shadow-sm"
                            title="취소"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <span>{row.value || <span className="text-slate-400 italic">{activeTabConfig.fallback}</span>}</span>
                          {/* 대분류: 소분류 수 배지 */}
                          {effectiveTabKey === 'category' && !isOrderMode && (
                            <span className="text-xs text-indigo-500 dark:text-indigo-400">
                              ({(customMasterData.namesByCategory[row.value] || []).length}종 소분류 ▶)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        {effectiveTabKey === 'category'
                          ? `${(customMasterData.namesByCategory[row.value] || []).length}개`
                          : `${row.count}개`
                        }
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {editingValue !== row.value && (
                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(row.value); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded"
                            title="명칭 수정"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRequestDelete(row.value); }}
                            className="p-1.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50 rounded"
                            title="삭제 (초기화)"
                          >
                            <Trash2 size={16} />
                          </button>
                          {effectiveTabKey === 'name' && row.value && (
                            <>
                              <select
                                value={moveTargets[row.value] || ''}
                                onChange={(e) => { e.stopPropagation(); setMoveTargets(prev => ({ ...prev, [row.value]: e.target.value })); }}
                                className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">대분류 선택</option>
                                {categoryOptions.map(category => (
                                  <option key={category} value={category}>{category}</option>
                                ))}
                              </select>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRequestMove(row.value, moveTargets[row.value] || ''); }}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap"
                              >
                                이동
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    {isOrderMode && (
                      <td className="px-4 py-3 text-center">
                        <GripVertical size={18} className="inline-block text-slate-400" />
                      </td>
                    )}
                  </tr>
                ))}
                {dataMap.length === 0 && (
                  <tr>
                    <td colSpan={isOrderMode ? 4 : 3} className="px-6 py-12 text-center text-slate-400">
                      {drillCategory !== null ? `[${drillCategory}] 소분류가 없습니다. 위에서 수동 추가하세요.` : '데이터가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
            <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
            <div>
              <p className="font-bold mb-1">사용 법</p>
              <p>• 명칭을 수정하여 기존에 존재하는 다른 명칭과 동일하게 만들면 자동으로 <strong>병합(Merge)</strong>합니다.</p>
              <p>• [삭제]를 실행하면 해당 그룹에 속한 모든 품목이 <strong>영구 삭제</strong>됩니다. (되돌릴 수 없음)</p>
              {activeTabKey === 'name' && (
                <p>• [이동]을 실행하면 선택한 소분류가 지정한 대분류로 일괄 이동합니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Confirmation Overlay */}
      {analysis && (
        <div className="absolute inset-0 z-[90] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden transform scale-100">
            <div className={`p-4 flex items-center gap-3 border-b ${(analysis.type === 'DELETE' || analysis.type === 'DELETE_SUBCATEGORY') ? 'bg-red-50 border-red-100 dark:bg-red-900/20' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20'}`}>
              <div className={`p-2 rounded-full ${(analysis.type === 'DELETE' || analysis.type === 'DELETE_SUBCATEGORY') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {analysis.type === 'DELETE' ? '데이터 초기화' : analysis.type === 'DELETE_SUBCATEGORY' ? '소분류 삭제' : analysis.type === 'MOVE_SUBCATEGORY' ? '소분류 이동' : '데이터 일괄 변경'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {analysis.type === 'MOVE_SUBCATEGORY' ? (
                <div className="flex flex-col items-center justify-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="text-xs text-slate-400">소분류</div>
                  <div className="text-slate-700 dark:text-slate-200">
                    {analysis.targetValue || '(공백)'}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">이동 대상 대분류</div>
                  <div className="text-indigo-600 dark:text-indigo-400">
                    {analysis.newValue || '(공백)'}
                  </div>
                  {analysis.moveSourceCategories && analysis.moveSourceCategories.length > 0 && (
                    <div className="text-xs text-slate-400 mt-2">
                      현재 대분류: {analysis.moveSourceCategories.join(', ')}
                    </div>
                  )}
                </div>
              ) : analysis.type === 'DELETE_SUBCATEGORY' ? (
                <div className="flex flex-col items-center justify-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="text-xs text-slate-400">대분류</div>
                  <div className="text-indigo-600 dark:text-indigo-400">
                    {analysis.newValue}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">삭제할 소분류</div>
                  <div className="text-red-600 dark:text-red-400 text-lg">
                    {analysis.targetValue}
                  </div>
                  <div className="text-xs text-red-500 dark:text-red-400 mt-2">
                    ⚠ 해당 소분류에 속한 인벤토리 품목도 함께 삭제됩니다
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">{activeTabConfig.label}</div>
                  <div className="flex items-center gap-4">
                    <span className="line-through text-slate-400">{analysis.targetValue || '(공백)'}</span>
                    <ArrowRight size={16} />
                    <span className="text-red-600 font-bold">
                      {analysis.type === 'DELETE' ? '삭제' : (analysis.newValue || '(공백)')}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-center">
                {analysis.type === 'DELETE_SUBCATEGORY' ? (
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    해당 소분류를 기준정보 목록에서 삭제합니다.<br />
                    {analysis.affectedCount > 0 && (
                      <span>연결된 인벤토리 품목 <strong className="text-red-600 dark:text-red-400">{analysis.affectedCount}개</strong>도 함께 삭제됩니다.</span>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="text-slate-600 dark:text-slate-400 mb-2">
                      이 작업은 총 <strong className="text-indigo-600 dark:text-indigo-400 text-lg">{analysis.affectedCount}개</strong>의 품목에 영향을 줍니다.
                    </p>
                    <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-2 rounded max-h-24 overflow-y-auto">
                      영향 받는 품목 예시: {analysis.affectedSample.join(', ')} ...
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-center text-red-500 font-bold mt-2">
                * 이 작업은 되돌릴 수 없습니다. 신중하게 결정해주세요.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setAnalysis(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={applyChanges}
                className={`px-6 py-2 rounded-lg text-white font-bold flex items-center gap-2 shadow-md transition-colors ${(analysis.type === 'DELETE' || analysis.type === 'DELETE_SUBCATEGORY') ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                <CheckCircle size={18} />
                {analysis.type === 'DELETE' ? '초기화 적용' : analysis.type === 'DELETE_SUBCATEGORY' ? '삭제 확인' : analysis.type === 'MOVE_SUBCATEGORY' ? '이동 적용' : '변경사항 적용'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 동기화 확인 모달 */}
      {showSyncConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <RefreshCw size={20} className="text-indigo-600" />
                서버 동기화 확인
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">변경사항을 서버와 동기화합니다.</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">변경 내역 ({changeLogRef.current.length}건)</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {changeLogRef.current.map((log, i) => (
                    <div key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  확인을 누르면 서버에서 최신 데이터를 다시 불러옵니다.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => { setShowSyncConfirm(false); onClose(); }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                닫기 (동기화 안함)
              </button>
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  onClose(); // 닫고 index.tsx의 onClose가 서버 동기화 실행
                  setIsSyncing(false);
                  setShowSyncConfirm(false);
                }}
                disabled={isSyncing}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 shadow-md transition-colors text-sm disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                확인 (동기화)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDataManagerModal;
