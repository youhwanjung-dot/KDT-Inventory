import React, { useMemo } from 'react';
import { Edit, AlertCircle, Box, Layers } from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatInteger, roundToInt } from '../../utils/formatters';
import { InventoryColWidths } from './types';
import { InventoryViewMode } from './InventoryToolbar';

interface ResizableThProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const ResizableTh: React.FC<ResizableThProps> = ({
  width,
  onResizeStart,
  children,
  className = '',
  align = 'center',
}) => (
  <th
    className={`relative px-2 py-3 select-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-sm whitespace-nowrap ${className}`}
    style={{ width, textAlign: align }}
  >
    <div
      className={`flex items-center h-full truncate ${
        align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {children}
    </div>
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-orange-500/50 active:bg-orange-600 z-10 transition-colors"
      onMouseDown={onResizeStart}
    />
  </th>
);

interface InventoryTableProps {
  items: InventoryItem[];
  allItems: InventoryItem[];
  viewMode: InventoryViewMode;
  colWidths: InventoryColWidths;
  onResizeStart: (e: React.MouseEvent, key: keyof InventoryColWidths) => void;
  onEdit: (id: string) => void;
  onTransaction: (item: InventoryItem) => void;
}

const getCommonMaterialKey = (item: Pick<InventoryItem, 'name' | 'plating' | 'spec'>): string =>
  `${(item.name || '').trim().toLowerCase()}||${(item.plating || '').trim().toLowerCase()}||${(item.spec || '').trim().toLowerCase()}`;

const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  allItems,
  viewMode,
  colWidths,
  onResizeStart,
  onEdit,
  onTransaction,
}) => {
  // Count how many ZONEs share the same (name + plating + spec) across the entire inventory
  const zoneCountByCommonKey = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allItems.forEach((item) => {
      const k = getCommonMaterialKey(item);
      const set = map.get(k) || new Set<string>();
      set.add(item.category);
      map.set(k, set);
    });
    return map;
  }, [allItems]);

  // Consolidated rows grouping identical (name + plating + spec) across ZONEs
  const consolidatedGroups = useMemo(() => {
    if (viewMode !== 'CONSOLIDATED') return [];
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        plating: string;
        spec: string;
        unit: string;
        eaPerUnit: number;
        totalStockEa: number;
        entries: InventoryItem[];
      }
    >();

    items.forEach((item) => {
      const k = getCommonMaterialKey(item);
      const existing = map.get(k);
      const stock = roundToInt(item.currentStock, 0);
      if (!existing) {
        map.set(k, {
          key: k,
          name: item.name,
          plating: item.plating || '',
          spec: item.spec || '',
          unit: item.unit || 'EA',
          eaPerUnit: roundToInt(item.eaPerUnit ?? 1, 1),
          totalStockEa: stock,
          entries: [item],
        });
      } else {
        existing.totalStockEa += stock;
        existing.entries.push(item);
      }
    });

    // Sort: multi-ZONE shared materials first so shop-floor mixing risks are highlighted at the top
    return Array.from(map.values()).sort((a, b) => {
      if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
      return a.name.localeCompare(b.name);
    });
  }, [items, viewMode]);

  if (viewMode === 'CONSOLIDATED') {
    return (
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-900">
        <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-bold">
            <Layers size={15} className="text-amber-600" />
            <span>
              [공통자재 혼입 실사 모드] 품명·도금·규격이 동일한 자재를 전 ZONE 통합 합산하여 작업장 실물 총재고와 ZONE별 장부 배분량을 대조합니다.
            </span>
          </div>
          <span className="font-mono font-bold">통합 {consolidatedGroups.length}종</span>
        </div>

        <table className="w-full text-sm text-left border-collapse">
          <thead className="sticky top-0 z-10 shadow-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-sm">
            <tr>
              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-center w-14">No</th>
              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 w-56">품명</th>
              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-center w-24">도금</th>
              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-center w-28">규격</th>
              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-center w-32">공통 구분</th>
              <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-44">
                작업장 실물 총재고 (합산)
              </th>
              <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                ZONE별 장부 배분 내역 (배지 클릭 시 해당 ZONE 입출고)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {consolidatedGroups.map((grp, idx) => {
              const isMultiZone = grp.entries.length > 1;
              return (
                <tr key={grp.key} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors">
                  <td className="px-3 py-3 text-center text-slate-400 font-mono text-xs font-bold">{idx + 1}</td>
                  <td className="px-3 py-3 font-black text-slate-900 dark:text-white">{grp.name}</td>
                  <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300 font-semibold text-xs">
                    {grp.plating || '-'}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-200 font-mono font-bold text-xs">
                    {grp.spec || '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isMultiZone ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                        {grp.entries.length}개 ZONE 공통
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-100 dark:bg-slate-800">
                        단일 ZONE
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-base text-orange-600 dark:text-orange-400">
                    {formatInteger(grp.totalStockEa)} EA
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {grp.entries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => onTransaction(entry)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border border-orange-200 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors"
                          title={`${entry.category} 입출고 모달 열기`}
                        >
                          <span>{entry.category}:</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {formatInteger(entry.currentStock)} EA
                          </span>
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-900">
      <table className="w-full text-sm text-left table-fixed border-collapse">
        <thead className="sticky top-0 z-10 shadow-sm">
          <tr>
            <ResizableTh width={colWidths.edit} onResizeStart={(e) => onResizeStart(e, 'edit')} className="text-center" />
            <ResizableTh width={colWidths.no} onResizeStart={(e) => onResizeStart(e, 'no')}>No</ResizableTh>
            <ResizableTh width={colWidths.category} onResizeStart={(e) => onResizeStart(e, 'category')} align="left">
              ZONE
            </ResizableTh>
            <ResizableTh width={colWidths.name} onResizeStart={(e) => onResizeStart(e, 'name')} align="left">
              품명
            </ResizableTh>
            <ResizableTh width={colWidths.plating} onResizeStart={(e) => onResizeStart(e, 'plating')}>
              도금
            </ResizableTh>
            <ResizableTh width={colWidths.spec} onResizeStart={(e) => onResizeStart(e, 'spec')}>
              규격
            </ResizableTh>
            <ResizableTh width={colWidths.currentStock} onResizeStart={(e) => onResizeStart(e, 'currentStock')} align="right">
              현재고
            </ResizableTh>
            <ResizableTh width={colWidths.unit} onResizeStart={(e) => onResizeStart(e, 'unit')}>
              단위
            </ResizableTh>
            <ResizableTh width={colWidths.location} onResizeStart={(e) => onResizeStart(e, 'location')}>
              보관위치
            </ResizableTh>
            <ResizableTh width={colWidths.note} onResizeStart={(e) => onResizeStart(e, 'note')} align="left">
              비고
            </ResizableTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item, index) => {
            const safeThreshold = roundToInt(item.safeStock, 0);
            const isLowStock = safeThreshold > 0
              ? roundToInt(item.currentStock, 0) < safeThreshold
              : roundToInt(item.currentStock, 0) === 0;

            const per = roundToInt(item.eaPerUnit ?? 1, 1);
            const showUnitRef = per > 1 && item.unit && item.unit.toUpperCase() !== 'EA';
            const convertedVal = showUnitRef ? roundToInt(item.currentStock, 0) / per : 0;
            const convertedStr = Number.isInteger(convertedVal)
              ? convertedVal.toLocaleString('ko-KR')
              : convertedVal.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

            const sharedZoneSet = zoneCountByCommonKey.get(getCommonMaterialKey(item));
            const sharedCount = sharedZoneSet ? sharedZoneSet.size : 1;

            return (
              <tr
                key={item.id}
                className="hover:bg-orange-50 dark:hover:bg-orange-900/10 group cursor-pointer transition-colors"
                onClick={() => onTransaction(item)}
              >
                <td
                  className="px-2 py-2.5 text-center border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onEdit(item.id)}
                    className="p-1.5 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900 transition-colors shadow-sm"
                    title="자재 정보 수정"
                    aria-label="자재 정보 수정"
                  >
                    <Edit size={14} strokeWidth={2.5} />
                  </button>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-400 font-mono text-xs font-bold">
                  {index + 1}
                </td>
                <td className="px-3 py-2.5 text-orange-700 dark:text-orange-400 font-extrabold text-sm truncate" title={item.category}>
                  {item.category}
                </td>
                <td className="px-3 py-2.5 font-black text-slate-900 dark:text-white text-sm truncate" title={item.name}>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{item.name}</span>
                    {sharedCount > 1 && (
                      <span
                        className="shrink-0 px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        title={`${sharedCount}개 ZONE에 중복 투입되는 공통 자재입니다 (작업장 혼입 주의)`}
                      >
                        공통({sharedCount})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-300 font-semibold text-xs truncate">
                  {item.plating || '-'}
                </td>
                <td className="px-2 py-2.5 text-center text-slate-700 dark:text-slate-200 font-mono font-bold text-xs truncate">
                  {item.spec || '-'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div
                    className={`flex items-center justify-end gap-1.5 ${
                      isLowStock ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-900 dark:text-white font-black'
                    }`}
                  >
                    <span className="text-base font-mono">{formatInteger(item.currentStock)}</span>
                    {isLowStock && <AlertCircle size={15} className="text-red-500 animate-pulse shrink-0" />}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                  {showUnitRef ? `${item.unit}(×${per})` : item.unit || 'EA'}
                </td>
                <td className="px-2 py-2.5 text-center text-slate-600 dark:text-slate-300 font-semibold text-xs truncate" title={item.location}>
                  {item.location || '-'}
                </td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-xs truncate" title={`${showUnitRef ? `(${convertedStr} ${item.unit}) ` : ''}${item.note || ''}`}>
                  {showUnitRef && (
                    <span className="text-orange-600 dark:text-orange-400 font-semibold mr-1">({convertedStr} {item.unit})</span>
                  )}
                  {item.note || ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="text-center py-20 text-slate-400 flex flex-col items-center">
          <Box size={48} className="mb-4 text-slate-300 dark:text-slate-700" strokeWidth={1} />
          <p className="text-lg font-medium">표시할 자재가 없습니다.</p>
          <p className="text-sm mt-1">검색어를 변경하거나 ZONE 필터를 확인해 주세요.</p>
        </div>
      )}
    </div>
  );
};

export default InventoryTable;
