import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Layers, Trash2, SlidersHorizontal } from 'lucide-react';
import { InventoryItem, MasterData } from '../types';
import { formatStockWithUnit, roundToInt } from '../utils/formatters';

interface StockFormProps {
  item?: InventoryItem;
  inventory: InventoryItem[];
  masterData: MasterData;
  onSave: (item: InventoryItem, applyAcrossZones?: boolean) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const StockForm: React.FC<StockFormProps> = ({ item, inventory, masterData, onSave, onDelete, onCancel }) => {
  const [pendingNewItem, setPendingNewItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    category: '',
    zoneId: '',
    name: '',
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
  });

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.categories.forEach((c, i) => map.set(c, i));
    return map;
  }, [masterData]);

  const nameOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.nameOrder.forEach((n, i) => map.set(n, i));
    return map;
  }, [masterData]);

  const uniqueCategories = useMemo(() => {
    const existing = inventory.map((i) => i.category).filter(Boolean);
    const custom = masterData.categories || [];
    return Array.from(new Set([...existing, ...custom])).sort((a, b) => {
      const orderA = categoryOrderMap.get(a);
      const orderB = categoryOrderMap.get(b);
      if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [inventory, masterData, categoryOrderMap]);

  const uniqueNames = useMemo(() => {
    const currentCat = formData.category?.trim();
    const relevant = currentCat ? inventory.filter((i) => i.category === currentCat) : inventory;
    const names = relevant.map((i) => i.name).filter(Boolean);
    const customNames = currentCat
      ? masterData.namesByCategory[currentCat] || []
      : Object.values(masterData.namesByCategory || {}).flat();
    return Array.from(new Set([...names, ...customNames])).sort((a, b) => a.localeCompare(b));
  }, [inventory, formData.category, masterData]);

  const uniquePlatings = useMemo(() => {
    const existing = inventory.map((i) => i.plating || '').filter(Boolean);
    return Array.from(new Set([...existing, '3가', 'SUS', '아연', '니켈', '무도금'])).sort();
  }, [inventory]);

  const uniqueSpecs = useMemo(() => {
    const existing = inventory.map((i) => i.spec || '').filter(Boolean);
    return Array.from(new Set(existing)).sort();
  }, [inventory]);

  const uniqueUnits = useMemo(() => {
    const existing = inventory.map((i) => i.unit).filter(Boolean);
    return Array.from(new Set(['EA', 'SET', 'BOX', ...existing]));
  }, [inventory]);

  const uniqueLocations = useMemo(() => {
    const existing = inventory.map((i) => i.location).filter(Boolean);
    const defaults = ['A-랙', 'B-랙', 'C-랙', '자재창고', '볼트보관함', '현장대기'];
    return Array.from(new Set([...existing, ...defaults])).sort();
  }, [inventory]);

  const uniqueSuppliers = useMemo(() => {
    const existing = inventory.map((i) => i.supplier).filter(Boolean);
    const defaults = ['고객사지급', '사급자재', '자재팀', '생산팀'];
    return Array.from(new Set([...existing, ...defaults])).sort();
  }, [inventory]);

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        plating: item.plating ?? '',
        spec: item.spec ?? '',
        unit: item.unit || 'EA',
        eaPerUnit: Math.max(1, roundToInt(item.eaPerUnit ?? 1, 1)),
        qtyPerProduct: item.qtyPerProduct ?? 0,
        setGroup: item.setGroup ?? '',
      });
    }
  }, [item]);

  const resolveZoneId = (categoryName: string): string => {
    const meta = masterData.zoneMeta || {};
    const matched = Object.values(meta).find((z) => z.displayName === categoryName);
    return matched?.zoneId || item?.zoneId || categoryName;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoryValue = String(formData.category || '').trim();
    const nameValue = String(formData.name || '').trim();
    const unitVal = String(formData.unit || 'EA').trim().toUpperCase();
    const eaPerUnitVal = unitVal === 'EA' ? 1 : Math.max(1, roundToInt(formData.eaPerUnit, 1));

    const newItem: InventoryItem = {
      id: item?.id || `INV-${Date.now()}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      category: categoryValue,
      zoneId: resolveZoneId(categoryValue),
      name: nameValue,
      plating: String(formData.plating || '').trim(),
      spec: String(formData.spec || '').trim(),
      unit: unitVal,
      eaPerUnit: eaPerUnitVal,
      qtyPerProduct: Number(formData.qtyPerProduct) || 0,
      setGroup: String(formData.setGroup || '').trim(),
      pkgUnit: eaPerUnitVal > 1 ? String(eaPerUnitVal) : '',
      pkgType: unitVal,
      outerPkg: formData.outerPkg || '',
      orderCategory: item?.orderCategory ?? categoryOrderMap.get(categoryValue),
      orderName: item?.orderName ?? nameOrderMap.get(nameValue),
      currentStock: roundToInt(formData.currentStock, 0),
      safeStock: Math.max(0, roundToInt(formData.safeStock, 0)),
      location: String(formData.location || '').trim(),
      supplier: String(formData.supplier || '').trim(),
      note: String(formData.note || '').trim(),
    };
    if (item) {
      onSave(newItem, false);
    } else {
      setPendingNewItem(newItem);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = new Set(['currentStock', 'safeStock', 'eaPerUnit', 'qtyPerProduct']);
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.has(name) ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleDelete = () => {
    if (item?.id) {
      onDelete(item.id);
      onCancel();
    }
  };

  const renderCombobox = (
    name: keyof InventoryItem,
    label: string,
    options: string[],
    placeholder = '',
    required = false
  ) => {
    const listId = `kdt-list-${name}`;
    const val = String(formData[name] ?? '');
    return (
      <div className="space-y-1 w-full">
        <label htmlFor={listId} className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          id={listId}
          type="text"
          name={name}
          value={val}
          onChange={handleChange}
          list={`${listId}-datalist`}
          required={required}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          placeholder={placeholder}
          autoComplete="off"
        />
        <datalist id={`${listId}-datalist`}>
          {options.map((opt, idx) => (
            <option key={`${opt}-${idx}`} value={opt} />
          ))}
        </datalist>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh] transition-colors border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-xl shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {item ? '자재 상세 정보 수정' : '신규 자재 등록'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 custom-scrollbar bg-white dark:bg-slate-900">
          <form id="stock-form" onSubmit={handleSubmit} className="space-y-4">
            {/* ZONE & Item Name */}
            <div className="grid grid-cols-2 gap-4">
              {renderCombobox('category', 'ZONE (대분류)', uniqueCategories, '예: ZONE16_Plus, ZONE18', true)}
              {renderCombobox('name', '품명 (소분류)', uniqueNames, '예: 육각쎔스볼트, 평와셔', true)}
            </div>

            {/* Plating & Spec */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/70 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                <Layers size={14} className="text-orange-500" />
                자재 사양 (도금 · 규격)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {renderCombobox('plating', '도금', uniquePlatings, '예: 3가, SUS (없으면 공란)')}
                {renderCombobox('spec', '규격', uniqueSpecs, '예: M6*25, M8 (없으면 공란)')}
              </div>
            </div>

            {/* Stock (EA) & Packaging Reference */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="currentStock" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  현재고 (EA 정수)<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  id="currentStock"
                  type="number"
                  name="currentStock"
                  min="0"
                  step="1"
                  required
                  value={formData.currentStock}
                  onChange={handleChange}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-lg font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-700 text-right focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="unit" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  공급/표시 단위<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  id="unit"
                  name="unit"
                  value={formData.unit || 'EA'}
                  onChange={handleChange}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {uniqueUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="eaPerUnit" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  1단위당 EA (참고)
                </label>
                <input
                  id="eaPerUnit"
                  type="number"
                  name="eaPerUnit"
                  min="1"
                  step="1"
                  disabled={(formData.unit || 'EA').toUpperCase() === 'EA'}
                  value={(formData.unit || 'EA').toUpperCase() === 'EA' ? 1 : formData.eaPerUnit}
                  onChange={handleChange}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-right font-semibold bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {(formData.unit || 'EA').toUpperCase() !== 'EA' && Number(formData.eaPerUnit) > 1 && (
              <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-orange-200/70 dark:border-orange-900">
                화면 표시 미리보기:{' '}
                <strong>{formatStockWithUnit(Number(formData.currentStock) || 0, formData.unit, Number(formData.eaPerUnit))}</strong>
              </div>
            )}

            {/* Safe Stock & Location & Supplier */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="safeStock" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  적정재고 (EA)
                </label>
                <input
                  id="safeStock"
                  type="number"
                  name="safeStock"
                  min="0"
                  step="1"
                  value={formData.safeStock}
                  onChange={handleChange}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="0 (미설정)"
                />
              </div>
              {renderCombobox('location', '보관위치', uniqueLocations, '예: A-랙, 자재창고')}
              {renderCombobox('supplier', '공급구분/부서', uniqueSuppliers, '예: 고객사지급')}
            </div>

            {/* Phase 2 Pre-built BOM Fields */}
            <div className="bg-slate-50/80 dark:bg-slate-800/30 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                <SlidersHorizontal size={13} className="text-orange-500" />
                생산 연동 기준 (2차 BOM 스키마 선반영)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="qtyPerProduct" className="text-xs text-slate-500 dark:text-slate-400">
                    완제품 1대당 소요량 (1 SET)
                  </label>
                  <input
                    id="qtyPerProduct"
                    type="number"
                    name="qtyPerProduct"
                    min="0"
                    step="1"
                    value={formData.qtyPerProduct}
                    onChange={handleChange}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="예: 4"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="setGroup" className="text-xs text-slate-500 dark:text-slate-400">
                    소속 SET 그룹명 (선택)
                  </label>
                  <input
                    id="setGroup"
                    type="text"
                    name="setGroup"
                    value={formData.setGroup || ''}
                    onChange={handleChange}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="예: 육각볼트 SET M6*25"
                  />
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label htmlFor="note" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                비고 (소포장 pkg 내역 등 참고)
              </label>
              <textarea
                id="note"
                name="note"
                value={formData.note || ''}
                onChange={handleChange}
                rows={2}
                placeholder="예: 4000x9pkg + 1000 = 37,000ea"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors resize-none"
              />
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
              className="px-6 py-2.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 font-bold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-orange-500/20"
            >
              <Check size={18} />
              저장
            </button>
          </div>
        </div>
      </div>
      {pendingNewItem && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-item-scope-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 id="new-item-scope-title" className="font-bold text-slate-900 dark:text-white">
                다른 대분류에도 품목을 등록할까요?
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                신규 품목 “{pendingNewItem.name}”을(를) {pendingNewItem.category} 외 대분류에도 현재고 0으로 추가할지 선택해 주세요.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                기존 품목, 재고 및 수불 이력은 변경되지 않습니다.
              </p>
            </div>
            <div className="p-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNewItem(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const newItem = pendingNewItem;
                  setPendingNewItem(null);
                  onSave(newItem, false);
                }}
                className="px-4 py-2 rounded-lg border border-orange-300 dark:border-orange-700 text-sm font-semibold text-orange-700 dark:text-orange-300"
              >
                이 대분류만 등록
              </button>
              <button
                type="button"
                onClick={() => {
                  const newItem = pendingNewItem;
                  setPendingNewItem(null);
                  onSave(newItem, true);
                }}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-sm font-bold text-white"
              >
                전체 대분류에 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockForm;
