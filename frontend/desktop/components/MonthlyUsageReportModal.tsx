import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Printer, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InventoryItem, InventoryTransaction, MasterData, ZoneArchiveData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import { api } from '../utils/api';
import { compareCategoryWithOrder, compareInventoryItems, sortInventoryItems } from '../utils/inventorySort';

interface MonthlyUsageReportModalProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  viewMode: 'MONTHLY' | 'ANNUAL' | 'ZONE';
  onClose: () => void;
}

const ROWS_PER_PAGE = 40;
const A3_PAGE_WIDTH_PX = 297 * 96 / 25.4;
const A3_PAGE_HEIGHT_PX = 420 * 96 / 25.4;
const usageReportPageStyle = `
  @page usage-report {
    size: A3 portrait;
    margin: 10mm;
  }
  @media print {
    .usage-report-preview-sheet {
      display: contents !important;
      zoom: 1 !important;
    }
    .print-page.usage-report-print-page {
      page: usage-report;
      width: 277mm !important;
      max-width: 277mm !important;
      height: 400mm !important;
      max-height: 400mm !important;
      padding: 10mm !important;
      box-sizing: border-box !important;
    }
  }
`;

const MonthlyUsageReportModal: React.FC<MonthlyUsageReportModalProps> = ({
  items,
  transactions,
  masterData,
  viewMode,
  onClose,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(currentMonth);
  const [selectedZone, setSelectedZone] = useState(masterData.categories[0] || '');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [archivedUsageData, setArchivedUsageData] = useState<ZoneArchiveData[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useEffect(() => {
    let fields = DEFAULT_DB_FIELDS;
    try {
      const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
      if (saved) fields = JSON.parse(saved);
    } catch {
      // Keep default labels when saved field settings are invalid.
    }

    const labelMap: Record<string, string> = {};
    fields.forEach((field) => {
      const cleanLabel = field.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
      labelMap[field.key] = cleanLabel || field.label;
    });
    setLabels(labelMap);
  }, []);

  const getLabel = (key: string, defaultValue: string) => labels[key] || defaultValue;

  useEffect(() => {
    let isMounted = true;

    const loadArchivedUsageData = async () => {
      try {
        const summaries = await api.getZoneArchives();
        const archivedSummaries = summaries.filter((archive) => archive.status === 'ARCHIVED');
        const archives = await Promise.all(
          archivedSummaries.map((archive) => api.getZoneArchive(archive.id))
        );
        if (isMounted) setArchivedUsageData(archives);
      } catch {
        if (isMounted) setArchivedUsageData([]);
      }
    };

    void loadArchivedUsageData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const updatePreviewScale = () => {
      const availableWidth = Math.max(0, window.innerWidth - 32);
      const availableHeight = Math.max(0, window.innerHeight - 180);
      const scale = Math.min(1, availableWidth / A3_PAGE_WIDTH_PX, availableHeight / A3_PAGE_HEIGHT_PX);
      setPreviewScale(Math.max(0.1, scale));
    };

    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, []);

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.categories.forEach((category, index) => map.set(category, index));
    return map;
  }, [masterData.categories]);

  const archivedZoneNames = useMemo(
    () => archivedUsageData.map((archive) => archive.displayName),
    [archivedUsageData]
  );

  const availableZones = useMemo(() => {
    const names = Array.from(new Set([
      ...masterData.categories,
      ...archivedZoneNames,
    ].filter(Boolean)));
    return names.sort((a, b) => compareCategoryWithOrder(a, b, categoryOrderMap));
  }, [masterData.categories, archivedZoneNames, categoryOrderMap]);

  useEffect(() => {
    if (viewMode === 'ZONE' && !availableZones.includes(selectedZone)) {
      setSelectedZone(availableZones[0] || '');
    }
  }, [viewMode, availableZones, selectedZone]);

  const archivedItems = useMemo(
    () => archivedUsageData.flatMap((archive) =>
      archive.inventory.map((item) => ({
        ...item,
        category: item.category || archive.displayName,
        zoneId: item.zoneId || archive.zoneId,
      }))
    ),
    [archivedUsageData]
  );

  const archivedTransactions = useMemo(
    () => archivedUsageData.flatMap((archive) =>
      archive.transactions.map((transaction) => ({
        ...transaction,
        category: transaction.category || archive.displayName,
        zoneId: transaction.zoneId || archive.zoneId,
      }))
    ),
    [archivedUsageData]
  );

  const usageItems = useMemo(
    () => [...items, ...archivedItems],
    [items, archivedItems]
  );

  const usageTransactions = useMemo(
    () => [...transactions, ...archivedTransactions],
    [transactions, archivedTransactions]
  );

  // Extract transactions in the selected year using their date-only ISO prefix.
  const yearTxs = useMemo(() => {
    return usageTransactions.filter((tx) => {
      if (tx.type !== 'IN' && tx.type !== 'OUT') return false;
      return String(tx.date || '').slice(0, 4) === String(selectedYear);
    });
  }, [usageTransactions, selectedYear]);

  // Create a map of items from transactions (to support deleted items with historical usage)
  const txItemsMap = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      category: string;
      plating: string;
      spec: string;
    }>();
    yearTxs.forEach((tx) => {
      if (!map.has(tx.itemId)) {
        map.set(tx.itemId, {
          id: tx.itemId,
          name: tx.itemName,
          category: tx.category || '기타',
          plating: tx.plating || '',
          spec: tx.spec || '',
        });
      }
    });
    return map;
  }, [yearTxs]);

  // Merge current inventory items and transaction items
  const mergedItems = useMemo(() => {
    const itemsMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      plating: string;
      spec: string;
    }>();

    // 1. Add current inventory items
    usageItems.forEach((item) => {
      itemsMap.set(item.id, {
        id: item.id,
        name: item.name,
        category: item.category,
        plating: item.plating || '',
        spec: item.spec || '',
      });
    });

    // 2. Add transaction-only items (if not already present)
    txItemsMap.forEach((txItem, id) => {
      if (!itemsMap.has(id)) {
        itemsMap.set(id, txItem);
      }
    });

    return Array.from(itemsMap.values());
  }, [usageItems, txItemsMap]);

  // Usage views aggregate OUT quantities by item definition, optionally scoped to one ZONE.
  const reportData = useMemo(() => {
    type UsageRow = {
      id: string;
      category: string;
      name: string;
      plating: string;
      spec: string;
      monthsUsage: number[];
      totalOut: number;
    };

    const normalize = (value: string | undefined) =>
      String(value || '').normalize('NFC').trim().toLocaleLowerCase();
    const definitionKey = (name: string, plating?: string, spec?: string) =>
      [name, plating, spec].map(normalize).join('\u0000');
    const rows = new Map<string, UsageRow>();
    const keyByItemId = new Map<string, string>();
    const categoryByItemId = new Map(mergedItems.map((item) => [item.id, item.category]));
    const firstMonth = viewMode === 'MONTHLY' ? selectedMonth : viewMode === 'ZONE' ? startMonth : 1;
    const lastMonth = viewMode === 'MONTHLY' ? selectedMonth : viewMode === 'ZONE' ? endMonth : 12;
    const chooseCategory = (currentCategory: string, nextCategory: string) => {
      if (!currentCategory) return nextCategory;
      if (!nextCategory) return currentCategory;
      return compareCategoryWithOrder(nextCategory, currentCategory, categoryOrderMap) < 0
        ? nextCategory
        : currentCategory;
    };

    const ensureRow = (
      key: string,
      category: string,
      name: string,
      plating = '',
      spec = '',
    ) => {
      let row = rows.get(key);
      if (!row) {
        row = {
          id: key,
          category,
          name,
          plating,
          spec,
          monthsUsage: Array(12).fill(0),
          totalOut: 0,
        };
        rows.set(key, row);
      } else {
        row.category = chooseCategory(row.category, category);
      }
      return row;
    };

    const scopedItems = viewMode === 'ZONE'
      ? mergedItems.filter((item) => item.category === selectedZone)
      : mergedItems;

    scopedItems.forEach((item) => {
      const key = definitionKey(item.name, item.plating, item.spec);
      keyByItemId.set(item.id, key);
      ensureRow(key, item.category || '기타', item.name, item.plating || '', item.spec || '');
    });

    yearTxs.forEach((tx) => {
      const monthIndex = Number(String(tx.date || '').slice(5, 7)) - 1;
      if (monthIndex < firstMonth - 1 || monthIndex >= lastMonth) return;
      if (
        viewMode === 'ZONE' &&
        (categoryByItemId.get(tx.itemId) || tx.category || '기타') !== selectedZone
      ) return;

      const name = tx.itemName || tx.itemId;
      const category = categoryByItemId.get(tx.itemId) || tx.category || '기타';
      const key = keyByItemId.get(tx.itemId) || definitionKey(name, tx.plating, tx.spec);
      const row = ensureRow(key, category, name, tx.plating || '', tx.spec || '');
      if (tx.type === 'OUT' && monthIndex >= 0 && monthIndex < 12) {
        row.monthsUsage[monthIndex] += Number(tx.quantity) || 0;
      }
    });

    const calculated = Array.from(rows.values()).map((row) => {
      const monthsUsage = row.monthsUsage.map((quantity) => Math.round(quantity));
      return {
        ...row,
        monthsUsage,
        totalOut: monthsUsage.reduce((sum, quantity) => sum + quantity, 0),
      };
    });

    const filtered = calculated.filter((row) => {
      const searchable = [row.name, row.plating, row.spec].join(' ').toLowerCase();
      const matchesSearch = searchable.includes(searchTerm.toLowerCase());
      const matchesActive = activeOnly ? row.totalOut > 0 : true;
      return matchesSearch && matchesActive;
    });

    return sortInventoryItems(filtered, categoryOrderMap);
  }, [
    viewMode,
    selectedMonth,
    startMonth,
    endMonth,
    selectedZone,
    mergedItems,
    yearTxs,
    activeOnly,
    searchTerm,
    categoryOrderMap,
  ]);

  // Match the monthly ledger's carry-over and historical stock calculation.
  const stockReportData = useMemo(() => {
    if (viewMode === 'ANNUAL') return [];

    type StockUsageRow = {
      id: string;
      name: string;
      plating: string;
      spec: string;
      category: string;
      sortCategory: string;
      unit: string;
      location: string;
      startStock: number;
      totalIn: number;
      totalOut: number;
      endStock: number;
    };

    const firstMonth = viewMode === 'MONTHLY' ? selectedMonth : startMonth;
    const lastMonth = viewMode === 'MONTHLY' ? selectedMonth : endMonth;
    const startDate = `${selectedYear}-${String(firstMonth).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(selectedYear, lastMonth, 1)).toISOString().slice(0, 10);
    const scopedItems = viewMode === 'ZONE'
      ? usageItems.filter((item) => item.category === selectedZone)
      : usageItems;
    const transactionsByItemId = new Map<string, InventoryTransaction[]>();

    usageTransactions.forEach((tx) => {
      const itemTransactions = transactionsByItemId.get(tx.itemId) || [];
      itemTransactions.push(tx);
      transactionsByItemId.set(tx.itemId, itemTransactions);
    });

    const rows = new Map<string, StockUsageRow>();
    const locationsByDefinition = new Map<string, Set<string>>();
    const normalize = (value: string | undefined) =>
      String(value || '').normalize('NFC').trim().toLocaleLowerCase();
    const definitionKey = (name: string, plating?: string, spec?: string) =>
      [name, plating, spec].map(normalize).join('\u0000');
    const netMovement = (movements: InventoryTransaction[]) =>
      movements.reduce(
        (sum, tx) => sum + (tx.type === 'IN' ? Number(tx.quantity) || 0 : -(Number(tx.quantity) || 0)),
        0
      );
    const chooseCategory = (currentCategory: string, nextCategory: string) => {
      if (!currentCategory) return nextCategory;
      if (!nextCategory) return currentCategory;
      return compareCategoryWithOrder(nextCategory, currentCategory, categoryOrderMap) < 0
        ? nextCategory
        : currentCategory;
    };

    scopedItems.forEach((item) => {
      const key = definitionKey(item.name, item.plating, item.spec);
      const itemTransactions = transactionsByItemId.get(item.id) || [];
      const carryOvers = itemTransactions
        .filter((tx) => tx.reason === '재고이월')
        .sort((a, b) => b.date.localeCompare(a.date));
      const movements = itemTransactions.filter((tx) => tx.reason !== '재고이월');
      const periodMovements = movements.filter((tx) => tx.date >= startDate && tx.date < endDate);
      const totalIn = Math.round(
        periodMovements
          .filter((tx) => tx.type === 'IN')
          .reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0)
      );
      const totalOut = Math.round(
        periodMovements
          .filter((tx) => tx.type === 'OUT')
          .reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0)
      );
      const carryAtOrBeforePeriod = carryOvers.find((tx) => tx.date <= startDate);
      const carryAfterPeriod = [...carryOvers]
        .reverse()
        .find((tx) => tx.date >= endDate);

      let startStock: number;
      if (carryAtOrBeforePeriod) {
        const movementsSinceCarry = movements.filter(
          (tx) => tx.date >= carryAtOrBeforePeriod.date && tx.date < startDate
        );
        startStock = carryAtOrBeforePeriod.quantity + netMovement(movementsSinceCarry);
      } else if (carryAfterPeriod) {
        const movementsBeforeCarry = movements.filter(
          (tx) => tx.date >= startDate && tx.date < carryAfterPeriod.date
        );
        startStock = carryAfterPeriod.quantity - netMovement(movementsBeforeCarry);
      } else {
        const movementsAfterPeriodStart = movements.filter((tx) => tx.date >= startDate);
        startStock = item.currentStock - netMovement(movementsAfterPeriodStart);
      }

      const roundedStartStock = Math.round(startStock);
      const row = rows.get(key) || {
        id: key,
        name: item.name,
        plating: item.plating || '',
        spec: item.spec || '',
        category: viewMode === 'ZONE' ? selectedZone : '전체 ZONE',
        sortCategory: item.category || '기타',
        unit: 'EA',
        location: '',
        startStock: 0,
        totalIn: 0,
        totalOut: 0,
        endStock: 0,
      };
      row.sortCategory = chooseCategory(row.sortCategory, item.category || '기타');
      row.startStock += roundedStartStock;
      row.totalIn += totalIn;
      row.totalOut += totalOut;
      row.endStock += roundedStartStock + totalIn - totalOut;
      rows.set(key, row);

      const locations = locationsByDefinition.get(key) || new Set<string>();
      if (item.location?.trim()) locations.add(item.location.trim());
      locationsByDefinition.set(key, locations);
    });

    const calculated = Array.from(rows.values()).map((row) => {
      const locations = locationsByDefinition.get(row.id) || new Set<string>();
      return {
        ...row,
        location: locations.size > 1
          ? viewMode === 'MONTHLY' ? 'ZONE별 상이' : '복수'
          : Array.from(locations)[0] || '-',
        endStock: row.startStock + row.totalIn - row.totalOut,
      };
    });

    return calculated
      .filter((row) => {
        const searchable = [row.name, row.plating, row.spec].join(' ').toLowerCase();
        const matchesSearch = searchable.includes(searchTerm.toLowerCase());
        const matchesActive = activeOnly ? row.totalIn > 0 || row.totalOut > 0 : true;
        return matchesSearch && matchesActive;
      })
      .sort((a, b) =>
        compareInventoryItems(
          { ...a, category: a.sortCategory },
          { ...b, category: b.sortCategory },
          categoryOrderMap,
        )
      );
  }, [
    viewMode,
    selectedYear,
    selectedMonth,
    startMonth,
    endMonth,
    selectedZone,
    usageItems,
    usageTransactions,
    activeOnly,
    searchTerm,
    categoryOrderMap,
  ]);

  const displayedRows = viewMode === 'ANNUAL' ? reportData : stockReportData;

  // Pagination for print view
  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < displayedRows.length; i += ROWS_PER_PAGE) {
      chunks.push(displayedRows.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) return [[]];
    return chunks;
  }, [displayedRows]);

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: viewMode === 'MONTHLY'
      ? `${selectedYear}년_${selectedMonth}월_통합사용현황보고서`
      : viewMode === 'ZONE'
        ? `${selectedYear}년_${selectedZone}_${startMonth}-${endMonth}월_사용현황보고서`
        : `${selectedYear}년_연간사용현황보고서`,
    pageStyle: usageReportPageStyle,
  });

  const formatUsage = (val: number) => Math.round(Number(val) || 0).toLocaleString('ko-KR');

  // Explicit CSS Styles for print preview matching ReportModal.tsx
  const commonCellStyle: React.CSSProperties = {
    padding: '2px 4px',
    height: '33px',
    verticalAlign: 'middle',
    borderRight: '1px solid #f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '11px',
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  const headerCellStyle: React.CSSProperties = {
    ...commonCellStyle,
    height: '40px',
    backgroundColor: '#f1f5f9',
    borderRight: '1px solid #cbd5e1',
    borderTop: '2px solid #1e293b',
    borderBottom: '1px solid #1e293b',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a',
    display: 'table-cell',
  };

  const cellStyles = {
    name: {
      ...commonCellStyle,
      textAlign: 'left',
      fontWeight: '500',
      color: '#1e293b',
    } as React.CSSProperties,
    value: {
      ...commonCellStyle,
      textAlign: 'right',
      color: '#334155',
    } as React.CSSProperties,
    valueActive: {
      ...commonCellStyle,
      textAlign: 'right',
      fontWeight: 'bold',
      color: '#ea580c', // highlight non-zero values in orange
    } as React.CSSProperties,
  };
  const ledgerHeaderCellStyle = { ...headerCellStyle, fontSize: '14px' };
  const ledgerCellStyles = {
    no: { ...cellStyles.value, textAlign: 'center', fontSize: '14px' } as React.CSSProperties,
    category: { ...cellStyles.value, textAlign: 'center', fontSize: '14px' } as React.CSSProperties,
    name: { ...cellStyles.name, fontSize: '14px' } as React.CSSProperties,
    unit: { ...cellStyles.value, textAlign: 'center', fontSize: '14px' } as React.CSSProperties,
    stock: { ...cellStyles.value, fontSize: '14px', fontWeight: 'bold' } as React.CSSProperties,
    location: { ...cellStyles.value, textAlign: 'center', fontSize: '14px' } as React.CSSProperties,
  };

  // Year Selection Options
  const yearsOptions = useMemo(() => {
    const list = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);
  const monthsOptions = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto p-4 custom-scrollbar print-modal-overlay">
      {/* Top Controls Bar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex flex-wrap justify-center items-center gap-3 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg z-[110] border border-slate-200 dark:border-slate-700 no-print">
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">연도:</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              const year = Number(e.target.value);
              setSelectedYear(year);
              setStartMonth(1);
              setEndMonth(year === currentYear ? currentMonth : 12);
            }}
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-orange-500"
          >
            {yearsOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
        {viewMode === 'MONTHLY' && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">월:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              {monthsOptions.map((month) => <option key={month} value={month}>{month}월</option>)}
            </select>
          </div>
        )}
        {viewMode === 'ZONE' && (
          <>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">ZONE:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {availableZones.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">기간:</span>
              <select
                aria-label="시작월"
                value={startMonth}
                onChange={(e) => {
                  const month = Number(e.target.value);
                  setStartMonth(month);
                  if (month > endMonth) setEndMonth(month);
                }}
                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {monthsOptions.map((month) => <option key={month} value={month}>{month}월</option>)}
              </select>
              <span className="text-slate-500">~</span>
              <select
                aria-label="종료월"
                value={endMonth}
                onChange={(e) => {
                  const month = Number(e.target.value);
                  setEndMonth(month);
                  if (month < startMonth) setStartMonth(month);
                }}
                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {monthsOptions.map((month) => <option key={month} value={month}>{month}월</option>)}
              </select>
            </div>
          </>
        )}
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>

        {/* Search Field */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="품목명/도금/규격 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm w-40 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>

        {/* Checkbox Filter */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="w-4 h-4 accent-orange-600 cursor-pointer"
          />
          <span
            className={`text-sm font-medium transition-colors ${
              activeOnly ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {viewMode === 'ANNUAL' ? '소모량 있는 품목만' : '입출고 있는 품목만'}
          </span>
          <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
            {displayedRows.length}건
          </span>
        </label>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>


        <button
          onClick={handlePrint}
          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 text-sm font-bold transition-colors"
        >
          <Printer size={15} />
          인쇄
        </button>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-1"
        >
          <X size={20} />
        </button>
      </div>

      {/* Pages Container */}
      <div
        ref={contentRef}
        className="flex flex-col mt-24 mb-12 items-center print:block print:w-full print:m-0 print:p-0"
        style={{ gap: `${32 * previewScale}px` }}
      >
        {pages.map((pageItems, pageIndex) => {
          const emptySlotCount = Math.max(0, ROWS_PER_PAGE - Math.max(1, pageItems.length));
          return (
            <div
              key={pageIndex}
              className="usage-report-preview-sheet flex-none bg-white shadow-2xl"
              style={{
                width: '297mm',
                height: '420mm',
                padding: '10mm',
                boxSizing: 'border-box',
                zoom: previewScale,
              }}
            >
              <div
                className="print-page usage-report-print-page bg-white text-slate-900 w-full h-full relative flex flex-col justify-between mx-auto print:shadow-none"
                style={{
                  pageBreakAfter: 'always',
                  width: '277mm',
                  height: '400mm',
                  padding: '10mm',
                  boxSizing: 'border-box',
                }}
              >
              <div className="flex-1">
                {/* Header Section */}
                <div className="mb-2 border-b-2 border-slate-800 pb-2">
                  <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
                    {viewMode === 'MONTHLY'
                      ? '월간 사용현황 보고서'
                      : viewMode === 'ZONE'
                        ? `${selectedZone} ZONE 사용현황 보고서`
                        : '연간 사용현황 보고서'}
                  </h1>
                  <p className="text-[10px] text-center text-slate-500">
                    {viewMode === 'MONTHLY'
                      ? '전체 ZONE 통합 · 월간 입고·출고·재고 현황(EA)'
                      : viewMode === 'ZONE'
                        ? '선택 ZONE · 기간 누적 입고·출고·재고 현황(EA)'
                        : '전체 ZONE 합산 · 월별 출고 소모량(EA)'}
                  </p>
                  <div className="flex justify-between items-end mt-4">
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">기관명: KDT</p>
                      <p className="text-sm font-bold text-slate-700">
                        대상기간: {viewMode === 'ZONE'
                          ? `${selectedYear}년 ${startMonth}~${endMonth}월`
                          : viewMode === 'MONTHLY'
                            ? `${selectedYear}년 ${selectedMonth}월`
                            : `${selectedYear}년`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-medium">
                        출력일자: {new Date().toLocaleDateString('ko-KR')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Page {pageIndex + 1} / {pages.length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Table */}
                {viewMode === 'ANNUAL' ? (
                <table className="w-full text-[11px] border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '5%' }} /> {/* No */}
                    <col style={{ width: '29%' }} /> {/* 품목 정의 */}
                    <col style={{ width: '5.5%' }} /> {/* 1월 */}
                    <col style={{ width: '5.5%' }} /> {/* 2월 */}
                    <col style={{ width: '5.5%' }} /> {/* 3월 */}
                    <col style={{ width: '5.5%' }} /> {/* 4월 */}
                    <col style={{ width: '5.5%' }} /> {/* 5월 */}
                    <col style={{ width: '5.5%' }} /> {/* 6월 */}
                    <col style={{ width: '5.5%' }} /> {/* 7월 */}
                    <col style={{ width: '5.5%' }} /> {/* 8월 */}
                    <col style={{ width: '5.5%' }} /> {/* 9월 */}
                    <col style={{ width: '5.5%' }} /> {/* 10월 */}
                    <col style={{ width: '5.5%' }} /> {/* 11월 */}
                    <col style={{ width: '5.5%' }} /> {/* 12월 */}
                  </colgroup>
                  <thead>
                    <tr style={{ height: '40px' }}>
                      <th style={headerCellStyle}>No</th>
                      <th style={headerCellStyle}>품목명 / 도금 / 규격</th>
                      {Array.from({ length: 12 }, (_, m) => (
                        <th
                          key={m}
                          style={{ ...headerCellStyle, ...(m === 11 ? { borderRight: 'none' } : {}) }}
                        >
                          <div style={{ lineHeight: '1.1' }}>
                            <div style={{ fontSize: '11px' }}>{m + 1}월</div>
                            <div style={{ fontSize: '8px', fontWeight: '400', color: '#b91c1c' }}>출고(EA)</div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 || pageItems[0] === undefined ? (
                      <tr>
                        <td
                          style={{ ...cellStyles.value, textAlign: 'center' }}
                        >
                          1
                        </td>
                        <td
                          colSpan={13}
                          className="text-center text-slate-400 text-sm border border-slate-300"
                          style={{ height: '33px' }}
                        >
                          조회된 연간 소모량 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      (pageItems as typeof reportData).map((item, i) => {
                        const variant = [item.plating, item.spec].filter(Boolean).join(' / ');
                        return (
                          <tr
                            key={item.id}
                            style={{ height: '33px', backgroundColor: '#ffffff' }}
                          >
                            <td style={{ ...cellStyles.value, textAlign: 'center' }}>
                              {pageIndex * ROWS_PER_PAGE + i + 1}
                            </td>
                            <td style={cellStyles.name} title={[item.name, variant].filter(Boolean).join(' / ')}>
                              <div style={{ fontWeight: 600, lineHeight: '1.1' }}>{item.name}</div>
                              {variant && <div style={{ fontSize: '8px', color: '#64748b', lineHeight: '1.1' }}>{variant}</div>}
                            </td>
                            {item.monthsUsage.map((usage, mIdx) => (
                              <td
                                key={mIdx}
                                style={{
                                  ...cellStyles.value,
                                  padding: '2px 1px',
                                  textAlign: 'center',
                                  color: usage > 0 ? '#dc2626' : '#94a3b8',
                                  fontWeight: usage > 0 ? '600' : '400',
                                }}
                              >
                                {formatUsage(usage)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                    {Array.from({ length: emptySlotCount }).map((_, idx) => (
                      <tr
                        key={`empty-${pageIndex}-${idx}`}
                        style={{ height: '33px', backgroundColor: '#ffffff' }}
                      >
                        <td style={{ ...cellStyles.value, textAlign: 'center', color: '#94a3b8' }}>
                          {pageItems.length === 0 ? idx + 2 : pageIndex * ROWS_PER_PAGE + pageItems.length + idx + 1}
                        </td>
                        <td style={cellStyles.name}></td>
                        {Array.from({ length: 12 }, (_, monthIndex) => (
                          <td key={monthIndex} style={cellStyles.value}></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : (
                  <table className="w-full text-[13px] border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ height: '40px' }}>
                        <th style={ledgerHeaderCellStyle}>No</th>
                        <th style={ledgerHeaderCellStyle}>{getLabel('category', '대분류')}</th>
                        <th style={ledgerHeaderCellStyle}>{getLabel('name', '품목명')} / 도금 / 규격</th>
                        <th style={ledgerHeaderCellStyle}>{getLabel('unit', '단위')}</th>
                        <th style={ledgerHeaderCellStyle}>기초재고</th>
                        <th style={{ ...ledgerHeaderCellStyle, color: '#1d4ed8', backgroundColor: '#eff6ff' }}>입고</th>
                        <th style={{ ...ledgerHeaderCellStyle, color: '#b91c1c', backgroundColor: '#fef2f2' }}>출고</th>
                        <th style={ledgerHeaderCellStyle}>기말재고</th>
                        <th style={ledgerHeaderCellStyle}>{getLabel('location', '장소')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.length === 0 ? (
                        <tr>
                          <td style={ledgerCellStyles.no}>1</td>
                          <td
                            colSpan={8}
                            className="text-center text-slate-400 text-sm border border-slate-300"
                            style={{ height: '33px' }}
                          >
                            조회된 수불 데이터가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        (pageItems as typeof stockReportData).map((item, i) => {
                          const variant = [item.plating, item.spec].filter(Boolean).join(' / ');
                          return (
                            <tr key={item.id} style={{ height: '33px', backgroundColor: '#ffffff' }}>
                              <td style={ledgerCellStyles.no}>
                                {pageIndex * ROWS_PER_PAGE + i + 1}
                              </td>
                              <td style={ledgerCellStyles.category}>{item.category}</td>
                              <td style={ledgerCellStyles.name} title={[item.name, variant].filter(Boolean).join(' / ')}>
                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                                {variant && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#64748b' }}>{variant}</span>}
                              </td>
                              <td style={ledgerCellStyles.unit}>{item.unit}</td>
                              <td style={{ ...ledgerCellStyles.stock, backgroundColor: '#f8fafc' }}>
                                {formatUsage(item.startStock)}
                              </td>
                              <td style={{ ...ledgerCellStyles.stock, color: '#2563eb' }}>
                                {item.totalIn > 0 ? formatUsage(item.totalIn) : ''}
                              </td>
                              <td style={{ ...ledgerCellStyles.stock, color: '#dc2626' }}>
                                {item.totalOut > 0 ? formatUsage(item.totalOut) : ''}
                              </td>
                              <td style={{ ...ledgerCellStyles.stock, backgroundColor: '#f8fafc' }}>
                                {formatUsage(item.endStock)}
                              </td>
                              <td style={ledgerCellStyles.location}>{item.location}</td>
                            </tr>
                          );
                        })
                      )}
                      {Array.from({ length: emptySlotCount }).map((_, idx) => (
                        <tr
                          key={`empty-${pageIndex}-${idx}`}
                          style={{ height: '33px', backgroundColor: '#ffffff' }}
                        >
                          <td style={{ ...ledgerCellStyles.no, color: '#94a3b8' }}>
                            {pageItems.length === 0 ? idx + 2 : pageIndex * ROWS_PER_PAGE + pageItems.length + idx + 1}
                          </td>
                          <td style={ledgerCellStyles.category}></td>
                          <td style={ledgerCellStyles.name}></td>
                          <td style={ledgerCellStyles.unit}></td>
                          <td style={{ ...ledgerCellStyles.stock, backgroundColor: '#f8fafc' }}></td>
                          <td style={{ ...ledgerCellStyles.stock, color: '#2563eb' }}></td>
                          <td style={{ ...ledgerCellStyles.stock, color: '#dc2626' }}></td>
                          <td style={{ ...ledgerCellStyles.stock, backgroundColor: '#f8fafc' }}></td>
                          <td style={ledgerCellStyles.location}></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Page Footer Section */}
              <div className="mt-2 pt-2 border-t border-slate-300 text-[9px] text-slate-500 flex justify-between items-center">
                <span>System: KDT Inventory Manager</span>
                <span className="font-bold">KDT</span>
              </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default MonthlyUsageReportModal;
