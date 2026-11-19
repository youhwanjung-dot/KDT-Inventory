import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Layers, Info, Trash2 } from 'lucide-react';
import { InventoryItem, MasterData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY, FieldDef } from '../constants';
import { roundToOneDecimal } from '../utils/formatters';

interface StockFormProps {
  item?: InventoryItem;
  inventory: InventoryItem[];
  masterData: MasterData;
  onSave: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const StockForm: React.FC<StockFormProps> = ({ item, inventory, masterData, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    category: '',
    name: '',
    pkgUnit: '',
    pkgType: '',
    outerPkg: '',
    unit: 'EA',
    currentStock: 0,
    safeStock: 1,
    location: '',
    supplier: '',
    note: ''
  });

  // Custom Labels State
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let fields = DEFAULT_DB_FIELDS;
    try {
      const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
      if (saved) fields = JSON.parse(saved);
    } catch { }

    const labelMap: Record<string, string> = {};
    fields.forEach(f => {
      const cleanLabel = f.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
      labelMap[f.key] = cleanLabel || f.label;
    });
    setLabels(labelMap);
  }, []);

  // Use masterData prop directly (no localStorage needed)
  const customMasterData = masterData;

  const getLabel = (key: string, defaultLabel: string) => {
    return labels[key] || defaultLabel;
  };

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    customMasterData.categories.forEach((c, i) => map.set(c, i));
    return map;
  }, [customMasterData]);

  const nameOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    customMasterData.nameOrder.forEach((n, i) => map.set(n, i));
    return map;
  }, [customMasterData]);

  const maxCategoryOrder = useMemo(() => {
    let max = -1;
    categoryOrderMap.forEach(value => {
      if (value > max) max = value;
    });
    return max;
  }, [categoryOrderMap]);

  const maxNameOrder = useMemo(() => {
    let max = -1;
    nameOrderMap.forEach(value => {
      if (value > max) max = value;
    });
    return max;
  }, [nameOrderMap]);

  // --- Data Aggregation for Datalists ---

  // 1. Categories
  const uniqueCategories = useMemo(() => {
    const existing = inventory.map(i => i.category).filter(Boolean);
    const custom = customMasterData.categories || [];
    return Array.from(new Set([...existing, ...custom])).sort((a, b) => {
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

  // 2. Names (Filtered by current Category)
  const uniqueNames = useMemo(() => {
    // Filter items by currently selected category (if any)
    const currentCat = formData.category?.trim();
    let relevantItems = inventory;

    if (currentCat) {
      relevantItems = inventory.filter(i => i.category === currentCat);
    }

    const names = relevantItems.map(i => i.name).filter(Boolean);
    const customByCategory = customMasterData.namesByCategory || {};
    const customNames = currentCat
      ? (customByCategory[currentCat] || [])
      : Object.values(customByCategory).flat();
    return Array.from(new Set([...names, ...customNames])).sort((a, b) => {
      const orderA = nameOrderMap.get(a);
      const orderB = nameOrderMap.get(b);
      if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
        return orderA - orderB;
      }
      if (orderA !== undefined && orderB === undefined) return -1;
      if (orderA === undefined && orderB !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [inventory, formData.category, customMasterData, nameOrderMap]);

  // 3. Units
  const uniqueUnits = useMemo(() => {
    const units = inventory.map(i => i.unit).filter(Boolean);
    return Array.from(new Set([...units, 'EA', 'Box', 'Pack', 'Roll', 'Set'])).sort();
  }, [inventory]);

  // 4. Locations (Defaults + Existing)
  const uniqueLocations = useMemo(() => {
    const existing = inventory.map(i => i.location).filter(Boolean);
    const defaults = ["1창고", "2창고", "냉장고", "냉동고", "캐비닛 A", "캐비닛 B", "데스크"];
    return Array.from(new Set([...existing, ...defaults])).sort();
  }, [inventory]);

  // 5. Suppliers/Departments (Defaults + Existing)
  const uniqueSuppliers = useMemo(() => {
    const existing = inventory.map(i => i.supplier).filter(Boolean);
    const defaults = ["간호과", "시설과", "영양과", "사무국", "재활치료실", "요양보호사"];
    return Array.from(new Set([...existing, ...defaults])).sort();
  }, [inventory]);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    } else {
      // New Item Defaults
      // Do not auto-select category to allow datalist to show all options on first click
    }
  }, [item, uniqueCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoryValue = String(formData.category || '').trim();
    const nameValue = String(formData.name || '').trim();
    const resolvedCategoryOrder = item?.orderCategory ?? categoryOrderMap.get(categoryValue);
    const resolvedNameOrder = item?.orderName ?? nameOrderMap.get(nameValue);
    const newItem: InventoryItem = {
      id: item?.id || `INV-${Date.now()}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      pkgUnit: formData.pkgUnit || '',
      pkgType: formData.pkgType || '',
      outerPkg: formData.outerPkg || '',
      orderCategory: resolvedCategoryOrder,
      orderName: resolvedNameOrder,
      ...formData as any,
      currentStock: roundToOneDecimal(formData.currentStock, 0),
      safeStock: Math.max(0.1, roundToOneDecimal(formData.safeStock, 1))
    };
    onSave(newItem);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name === 'currentStock' || name === 'safeStock'
          ? (value === '' ? '' : Number(value))
          : value
      };

      return updated;
    });
  };

  const handleDelete = () => {
    if (item?.id) {
      onDelete(item.id);
      onCancel();
    }
  };

  // Reusable Input with Datalist
  const renderCombobox = (
    name: keyof InventoryItem,
    label: string,
    options: string[],
    placeholder: string = "",
    required: boolean = false,
    small: boolean = false
  ) => {
    const listId = `list-${name}`;
    const val = formData[name] as string;

    return (
      <div className="space-y-1 w-full">
        <label htmlFor={listId} className={`${small ? 'text-[10px] text-center block' : 'text-xs font-semibold'} text-slate-600 dark:text-slate-400`}>
          {small ? '' : `${label}`}
          {small && label}
        </label>
        <div className="relative">
          <input
            id={listId}
            type="text"
            name={name}
            value={val}
            onChange={handleChange}
            list={`${listId}-datalist`}
            required={required}
            className={`w-full border border-slate-300 dark:border-slate-600 rounded-lg ${small ? 'px-2 py-1.5 text-xs text-center' : 'px-3 py-2 text-sm'} focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors`}
            placeholder={placeholder}
            autoComplete="off"
          />
          <datalist id={`${listId}-datalist`}>
            {options.map((opt, idx) => (
              <option key={`${opt}-${idx}`} value={opt} />
            ))}
          </datalist>
        </div>
      </div>
    );
  };

  // Standard CSS for Select
  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-xl shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {item ? '재고 상세 정보 수정' : '신규 물품 등록'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 custom-scrollbar bg-white dark:bg-slate-900">
          <form id="stock-form" onSubmit={handleSubmit} className="space-y-4">

            {/* 1. Category & 2. Name */}
            <div className="grid grid-cols-2 gap-4">
              {renderCombobox('category', `1. ${getLabel('category', '대분류')}`, uniqueCategories, '분류 선택/입력', true)}
              {renderCombobox('name', `2. ${getLabel('name', '품목명')}`, uniqueNames, '품목명 입력', true)}
            </div>

            {/* 3,4,5. Specs */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-2">
                <Layers size={14} className="text-blue-500" />
                규격 및 구성
              </label>
              <div className="grid grid-cols-3 gap-2">
                {renderCombobox('pkgUnit', `3.${getLabel('pkgUnit', '포장단위')}`, [], '예: 10', false, true)}
                {renderCombobox('pkgType', `4.${getLabel('pkgType', '소포장 개수')}`, [], '예: 장 1팩', false, true)}
                {renderCombobox('outerPkg', `5.${getLabel('outerPkg', '박스구성')}`, [], '예: 10팩 1박스', false, true)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 6. 잔량 */}
              <div className="space-y-1">
                <label htmlFor="currentStock" className="text-xs font-semibold text-slate-600 dark:text-slate-400">6. {getLabel('currentStock', '잔량 (현재고)')}</label>
                <input
                  id="currentStock"
                  type="number"
                  name="currentStock"
                  min="0"
                  step="0.1"
                  required
                  value={formData.currentStock}
                  onChange={handleChange}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xl font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 text-right focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                />
              </div>

              {/* 7. 관리단위 */}
              <div className="space-y-1">
                <label htmlFor="unit" className="text-xs font-semibold text-slate-600 dark:text-slate-400">7. {getLabel('unit', '관리 단위')}</label>
                <input
                  id="unit"
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            {/* 적정재고 (상세 설정용) */}
            <div className="space-y-1 pt-2">
              <label htmlFor="safeStock" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex justify-between">
                <span>{getLabel('safeStock', '적정재고')} (미달 시 경고 표시)</span>
              </label>
              <input
                id="safeStock"
                type="number"
                name="safeStock"
                min="0.1"
                step="0.1"
                required
                value={formData.safeStock}
                onChange={handleChange}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
                placeholder="최소 0.1 이상"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Location */}
              {renderCombobox('location', getLabel('location', '보관장소'), uniqueLocations, '보관장소 입력')}

              {/* Supplier/Department */}
              {renderCombobox('supplier', getLabel('supplier', '사용부서'), uniqueSuppliers, '사용부서 입력')}
            </div>

            <div className="space-y-1">
              <label htmlFor="note" className="text-xs font-semibold text-slate-600 dark:text-slate-400">{getLabel('note', '비고')}</label>
              <textarea
                id="note"
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={2}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3 rounded-b-xl bg-white dark:bg-slate-900 shrink-0">
          <div>
            {item && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">삭제</span>
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              form="stock-form"
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-blue-500/20"
            >
              <Check size={18} />
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockForm;
