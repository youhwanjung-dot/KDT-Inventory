import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import ReportModal from '../ReportModal';
import ConfirmationModal from '../ConfirmationModal';
import { ActionLogger } from '../../utils/logger';
import { formatItemDisplayKey, roundToInt } from '../../utils/formatters';
import {
  DEFAULT_WIDTHS,
  InventoryColWidths,
  InventoryListProps,
  ItemActivityStats,
  WIDTH_STORAGE_KEY,
} from './types';
import { exportInventoryToExcel } from './excelExport';
import InventoryToolbar, { InventoryViewMode } from './InventoryToolbar';
import InventoryTable from './InventoryTable';
import ZoneSettlementModal from './ZoneSettlementModal';

const InventoryList: React.FC<InventoryListProps> = ({
  items,
  transactions,
  masterData,
  user,
  initialFilterMode = 'ALL',
  initialCategoryFilter = null,
  onAdd,
  onEdit,
  onReset,
  onTransaction,
  onOpenDBManager,
  onOpenMonthlyReport,
  onOpenMonthlyUsageReport,
  onOpenReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState<boolean>(initialFilterMode === 'LOW_STOCK');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategoryFilter ? [initialCategoryFilter] : []
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<InventoryViewMode>('BY_ZONE');
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLayoutReset, setShowLayoutReset] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ show: boolean; isError: boolean; message: string }>({
    show: false,
    isError: false,
    message: '',
  });

  useEffect(() => {
    setShowOnlyLowStock(initialFilterMode === 'LOW_STOCK');
  }, [initialFilterMode]);

  useEffect(() => {
    if (initialCategoryFilter) {
      setSelectedCategories([initialCategoryFilter]);
    }
  }, [initialCategoryFilter]);

  const [colWidths, setColWidths] = useState<InventoryColWidths>(() => {
    try {
      const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
      return saved ? { ...DEFAULT_WIDTHS, ...JSON.parse(saved) } : DEFAULT_WIDTHS;
    } catch {
      return DEFAULT_WIDTHS;
    }
  });

  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  const resizingRef = useRef<{ key: keyof InventoryColWidths; startX: number; startWidth: number } | null>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    setColWidths((prev) => ({
      ...prev,
      [key]: Math.max(40, startWidth + diff),
    }));
  };

  const handleMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent, key: keyof InventoryColWidths) => {
    e.preventDefault();
    resizingRef.current = { key, startX: e.clientX, startWidth: colWidths[key] };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 90-day transaction stats strictly keyed by itemId (never by itemName, preventing cross-ZONE collision)
  const item3MonthStats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const map = new Map<string, ItemActivityStats>();
    transactions.forEach((tx) => {
      if (!tx.date || tx.date < cutoffStr) return;
      const key = tx.itemId;
      if (!key) return;
      const existing = map.get(key) || { hasActivity: false, totalOut: 0, monthlyAvg: 0 };
      existing.hasActivity = true;
      if (tx.type === 'OUT') {
        existing.totalOut += roundToInt(tx.quantity, 0);
      }
      map.set(key, existing);
    });
    map.forEach((val) => {
      val.monthlyAvg = Math.round(val.totalOut / 3);
    });
    return map;
  }, [transactions]);

  const lowStockCount = useMemo(() => {
    return items.filter((item) => {
      const stats = item3MonthStats.get(item.id);
      const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
      const safe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : roundToInt(item.safeStock, 0);
      return safe > 0 && roundToInt(item.currentStock, 0) < safe;
    }).length;
  }, [items, item3MonthStats]);

  // ZONE & item sort maps from masterData
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.categories.forEach((c, i) => map.set(c, i));
    return map;
  }, [masterData]);

  const namesByCategoryOrderMap = useMemo(() => {
    const catMap = new Map<string, Map<string, number>>();
    masterData.categories.forEach((cat) => {
      const nMap = new Map<string, number>();
      (masterData.namesByCategory[cat] || []).forEach((n, idx) => nMap.set(n, idx));
      catMap.set(cat, nMap);
    });
    return catMap;
  }, [masterData]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    masterData.categories.forEach((c) => set.add(c));
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => {
      const ordA = categoryOrderMap.get(a);
      const ordB = categoryOrderMap.get(b);
      if (ordA !== undefined && ordB !== undefined) return ordA - ordB;
      if (ordA !== undefined) return -1;
      if (ordB !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [items, masterData, categoryOrderMap]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesSearch =
        !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.plating || '').toLowerCase().includes(q) ||
        (item.spec || '').toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q);

      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);

      const matchesLowStock =
        !showOnlyLowStock ||
        (() => {
          const stats = item3MonthStats.get(item.id);
          const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
          const safe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : roundToInt(item.safeStock, 0);
          return safe > 0 && roundToInt(item.currentStock, 0) < safe;
        })();

      return matchesSearch && matchesCategory && matchesLowStock;
    });

    return filtered.sort((a, b) => {
      const ordCatA = categoryOrderMap.get(a.category);
      const ordCatB = categoryOrderMap.get(b.category);
      if (ordCatA !== undefined && ordCatB !== undefined && ordCatA !== ordCatB) return ordCatA - ordCatB;
      if (ordCatA !== undefined) return -1;
      if (ordCatB !== undefined) return 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);

      const catNameMap = namesByCategoryOrderMap.get(a.category);
      if (catNameMap) {
        const ordNameA = catNameMap.get(formatItemDisplayKey(a)) ?? catNameMap.get(a.name);
        const ordNameB = catNameMap.get(formatItemDisplayKey(b)) ?? catNameMap.get(b.name);
        if (ordNameA !== undefined && ordNameB !== undefined && ordNameA !== ordNameB) return ordNameA - ordNameB;
        if (ordNameA !== undefined) return -1;
        if (ordNameB !== undefined) return 1;
      }
      return formatItemDisplayKey(a).localeCompare(formatItemDisplayKey(b));
    });
  }, [items, searchTerm, selectedCategories, showOnlyLowStock, item3MonthStats, categoryOrderMap, namesByCategoryOrderMap]);

  const handleExportExcel = async () => {
    ActionLogger.log('KDT Excel Export Initiated', { targetYear: exportYear });
    try {
      setIsExporting(true);
      const { unassignedCount, fileName, targetYear } = await exportInventoryToExcel({
        items,
        transactions,
        masterData,
        selectedCategories,
        categoryOrderMap,
        namesByCategoryOrderMap,
        targetYear: exportYear,
      });
      setExportResult({
        show: true,
        isError: false,
        message:
          unassignedCount > 0
            ? `${fileName} (${targetYear}년 캘린더·40슬롯) 생성 완료 (ZONE당 최대 40개 초과분 ${unassignedCount}건 미배치)`
            : `${fileName} (${targetYear}년 1년치 캘린더 · ZONE당 40슬롯 · 전년 이월재고 자동계산) 파일이 생성되었습니다.`,
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      setExportResult({
        show: true,
        isError: true,
        message: '엑셀 내보내기 실패: ' + (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetClick = () => {
    if (user.role !== 'admin') {
      setAlertModal({ title: '권한 부족', message: '관리자 권한이 필요합니다.' });
      return;
    }
    onReset();
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full animate-fade-in transition-colors">
        <InventoryToolbar
          user={user}
          uniqueCategories={uniqueCategories}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          isCategoryDropdownOpen={isCategoryDropdownOpen}
          setIsCategoryDropdownOpen={setIsCategoryDropdownOpen}
          showOnlyLowStock={showOnlyLowStock}
          setShowOnlyLowStock={setShowOnlyLowStock}
          lowStockCount={lowStockCount}
          filteredCount={filteredItems.length}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          viewMode={viewMode}
          setViewMode={setViewMode}
          exportYear={exportYear}
          setExportYear={setExportYear}
          onOpenSettlement={() => setShowSettlementModal(true)}
          onOpenReport={onOpenReport}
          onOpenMonthlyReport={onOpenMonthlyReport}
          onOpenDBManager={onOpenDBManager}
          onExportExcel={handleExportExcel}
          onShowStockReport={() => setShowReport(true)}
          onOpenMonthlyUsageReport={onOpenMonthlyUsageReport}
          onResetLayout={() => setShowLayoutReset(true)}
          onResetDB={handleResetClick}
          onAdd={onAdd}
        />

        <InventoryTable
          items={filteredItems}
          allItems={items}
          viewMode={viewMode}
          colWidths={colWidths}
          item3MonthStats={item3MonthStats}
          onResizeStart={handleMouseDown}
          onEdit={onEdit}
          onTransaction={onTransaction}
        />

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">
                <strong className="text-red-600 dark:text-red-400">붉은색 숫자</strong>: 적정재고 미달
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="text-amber-600 dark:text-amber-400">공통(N)</strong>: N개 ZONE 중복 투입 자재 (상단 [공통자재 합산보기]로 혼입 총재고 실사 가능)
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="pl-4 border-l border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
              표시 {filteredItems.length} / 총 {items.length}개 품목
            </div>
          </div>
        </div>
      </div>

      {showSettlementModal && (
        <ZoneSettlementModal
          items={items}
          categories={uniqueCategories}
          currentUser={user}
          initialZone={selectedCategories[0] || uniqueCategories[0]}
          onCompleted={(msg) => setAlertModal({ title: 'ZONE 정산 완료', message: msg })}
          onClose={() => setShowSettlementModal(false)}
        />
      )}
      {showReport && (
        <ReportModal items={filteredItems} masterData={masterData} onClose={() => setShowReport(false)} columnWidths={colWidths} />
      )}
      {showLayoutReset && (
        <ConfirmationModal
          title="레이아웃 초기화"
          message="테이블 컬럼 너비를 기본값으로 되돌리시겠습니까?"
          onConfirm={() => {
            setColWidths(DEFAULT_WIDTHS);
            setShowLayoutReset(false);
            ActionLogger.log('Layout Reset');
          }}
          onCancel={() => setShowLayoutReset(false)}
        />
      )}
      {alertModal && (
        <ConfirmationModal
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel="확인"
          onConfirm={() => setAlertModal(null)}
        />
      )}
      {isExporting && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col gap-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <div className="animate-spin text-orange-600 dark:text-orange-400">
              <Loader2 size={48} />
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {exportYear}년 KDT 수불부 엑셀(40슬롯) 생성 중...
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">잠시만 기다려주세요.</p>
          </div>
        </div>
      )}
      {exportResult.show && (
        <ConfirmationModal
          title={exportResult.isError ? '내보내기 실패' : '내보내기 성공'}
          message={exportResult.message}
          confirmLabel="확인"
          onConfirm={() => setExportResult({ ...exportResult, show: false })}
          isDangerous={exportResult.isError}
        />
      )}
    </>
  );
};

export default InventoryList;
