import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Printer, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InventoryItem, InventoryTransaction, MasterData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { ActionLogger } from '../utils/logger';
import { roundToOneDecimal } from '../utils/formatters';

interface MonthlyUsageReportModalProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  onClose: () => void;
}

const ROWS_PER_PAGE = 33;

const MonthlyUsageReportModal: React.FC<MonthlyUsageReportModalProps> = ({
  items,
  transactions,
  masterData,
  onClose,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showZeroUsage, setShowZeroUsage] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let fields = DEFAULT_DB_FIELDS;
    try {
      const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
      if (saved) fields = JSON.parse(saved);
    } catch {}

    const labelMap: Record<string, string> = {};
    fields.forEach((f) => {
      const cleanLabel = f.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
      labelMap[f.key] = cleanLabel || f.label;
    });
    setLabels(labelMap);
  }, []);

  const getLabel = (key: string, defaultVal: string) => labels[key] || defaultVal;

  // Build order maps from masterData prop
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.categories.forEach((c, i) => map.set(c, i));
    return map;
  }, [masterData]);

  const nameOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    let globalIdx = 0;
    masterData.categories.forEach((cat) => {
      (masterData.namesByCategory[cat] || []).forEach((n) => {
        if (!map.has(n)) {
          map.set(n, globalIdx++);
        }
      });
    });
    masterData.nameOrder.forEach((n) => {
      if (!map.has(n)) {
        map.set(n, globalIdx++);
      }
    });
    return map;
  }, [masterData]);

  // Extract all OUT transactions in the selected year
  const yearTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.type !== 'OUT') return false;
      const txYear = new Date(tx.date).getFullYear();
      return txYear === selectedYear;
    });
  }, [transactions, selectedYear]);

  // Create a map of items from transactions (to support deleted items with historical usage)
  const txItemsMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string; unit: string }>();
    yearTxs.forEach((tx) => {
      if (!map.has(tx.itemId)) {
        map.set(tx.itemId, {
          id: tx.itemId,
          name: tx.itemName,
          category: tx.category || '기타',
          unit: 'EA',
        });
      }
    });
    return map;
  }, [yearTxs]);

  // Merge current inventory items and transaction items
  const mergedItems = useMemo(() => {
    const itemsMap = new Map<string, { id: string; name: string; category: string; unit: string }>();

    // 1. Add current inventory items
    items.forEach((item) => {
      itemsMap.set(item.id, {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
      });
    });

    // 2. Add transaction-only items (if not already present)
    txItemsMap.forEach((txItem, id) => {
      if (!itemsMap.has(id)) {
        itemsMap.set(id, txItem);
      }
    });

    return Array.from(itemsMap.values());
  }, [items, txItemsMap]);

  // Calculate monthly usage (OUT sum) for each item in the selected year
  const reportData = useMemo(() => {
    const calculated = mergedItems.map((item) => {
      const monthsUsage = Array(12).fill(0);
      let annualTotal = 0;

      for (let m = 1; m <= 12; m++) {
        const prefix = `${selectedYear}-${String(m).padStart(2, '0')}`;
        const monthTxs = yearTxs.filter((tx) => tx.itemId === item.id && tx.date.startsWith(prefix));
        const usage = roundToOneDecimal(monthTxs.reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0));
        monthsUsage[m - 1] = usage;
        annualTotal = roundToOneDecimal(annualTotal + usage);
      }

      return {
        ...item,
        monthsUsage,
        annualTotal,
      };
    });

    // Filters: Search Term & Usage presence
    const filtered = calculated.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = showZeroUsage ? true : row.annualTotal > 0;
      return matchesSearch && matchesActive;
    });

    // Sort by Category order, then Item Name order
    return filtered.sort((a, b) => {
      const orderCategoryA = categoryOrderMap.get(a.category);
      const orderCategoryB = categoryOrderMap.get(b.category);
      if (orderCategoryA !== undefined && orderCategoryB !== undefined && orderCategoryA !== orderCategoryB) {
        return orderCategoryA - orderCategoryB;
      }
      if (orderCategoryA !== undefined && orderCategoryB === undefined) return -1;
      if (orderCategoryA === undefined && orderCategoryB !== undefined) return 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);

      const orderNameA = nameOrderMap.get(a.name);
      const orderNameB = nameOrderMap.get(b.name);
      if (orderNameA !== undefined && orderNameB !== undefined && orderNameA !== orderNameB) {
        return orderNameA - orderNameB;
      }
      if (orderNameA !== undefined && orderNameB === undefined) return -1;
      if (orderNameA === undefined && orderNameB !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [mergedItems, yearTxs, selectedYear, showZeroUsage, searchTerm, categoryOrderMap, nameOrderMap]);

  // Pagination for print view
  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < reportData.length; i += ROWS_PER_PAGE) {
      chunks.push(reportData.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) return [[]];
    return chunks;
  }, [reportData]);

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `${selectedYear}년_월별사용량보고서`,
  });

  const formatUsage = (val: number) => {
    const num = roundToOneDecimal(val, 0);
    if (num === 0) return '0';
    return num % 1 === 0 ? String(num) : num.toFixed(1);
  };



  // Category RowSpan calculation per page (for portrait printing)
  const getCategoryRowSpan = (pageItems: any[], currentIndex: number) => {
    const currentCategory = pageItems[currentIndex].category;
    if (currentIndex > 0 && pageItems[currentIndex - 1].category === currentCategory) {
      return 0; // merged
    }
    let count = 1;
    for (let i = currentIndex + 1; i < pageItems.length; i++) {
      if (pageItems[i].category === currentCategory) count++;
      else break;
    }
    return count;
  };

  // Explicit CSS Styles for print preview matching ReportModal.tsx
  const commonCellStyle: React.CSSProperties = {
    padding: '4px 4px',
    height: '24px',
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
    height: '30px',
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
    category: {
      ...commonCellStyle,
      textAlign: 'center',
      fontWeight: '600',
      color: '#0f172a',
    } as React.CSSProperties,
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
      color: '#2563eb', // highlight non-zero values in blue
    } as React.CSSProperties,
  };

  // Year Selection Options
  const yearsOptions = useMemo(() => {
    const list = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto p-4 custom-scrollbar print-modal-overlay">
      {/* Top Controls Bar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg z-[110] border border-slate-200 dark:border-slate-700 no-print">
        {/* Year Dropdown */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">연도:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
          >
            {yearsOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>

        {/* Search Field */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="품목명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm w-40 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>

        {/* Checkbox Filter */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={showZeroUsage}
            onChange={(e) => setShowZeroUsage(e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span
            className={`text-sm font-medium transition-colors ${
              showZeroUsage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            사용량 없는 품목 포함
          </span>
          <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
            {reportData.length}건
          </span>
        </label>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>


        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 text-sm font-bold transition-colors"
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
        className="flex flex-col gap-8 my-12 items-center print:block print:w-full print:m-0 print:p-0"
      >
        {pages.map((pageItems, pageIndex) => {
          return (
            <div
              key={pageIndex}
              className="print-page bg-white text-slate-900 w-full shadow-2xl relative flex flex-col justify-between mx-auto mb-8 print:mb-0 print:shadow-none"
              style={{ pageBreakAfter: 'always', padding: '15mm 10mm' }}
            >
              <div className="flex-1">
                {/* Header Section */}
                <div className="mb-2 border-b-2 border-slate-800 pb-2">
                  <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">월별 사용현황 보고서</h1>
                  <div className="flex justify-between items-end mt-4">
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">기관명: KDT</p>
                      <p className="text-sm font-bold text-slate-700">대상년도: {selectedYear}년</p>
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
                <table className="w-full text-[11px] border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '10%' }} /> {/* 대분류 */}
                    <col style={{ width: '24%' }} /> {/* 품목명 */}
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
                    <tr style={{ height: '30px' }}>
                      <th style={headerCellStyle}>{getLabel('category', '대분류')}</th>
                      <th style={headerCellStyle}>{getLabel('name', '품목명')}</th>
                      <th style={headerCellStyle}>1월</th>
                      <th style={headerCellStyle}>2월</th>
                      <th style={headerCellStyle}>3월</th>
                      <th style={headerCellStyle}>4월</th>
                      <th style={headerCellStyle}>5월</th>
                      <th style={headerCellStyle}>6월</th>
                      <th style={headerCellStyle}>7월</th>
                      <th style={headerCellStyle}>8월</th>
                      <th style={headerCellStyle}>9월</th>
                      <th style={headerCellStyle}>10월</th>
                      <th style={headerCellStyle}>11월</th>
                      <th style={{ ...headerCellStyle, borderRight: 'none' }}>12월</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 || pageItems[0] === undefined ? (
                      <tr>
                        <td
                          colSpan={14}
                          className="text-center py-20 text-slate-400 text-sm border border-slate-300"
                        >
                          조회된 월별사용량 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((item: any, i: number) => {
                        const rowSpan = getCategoryRowSpan(pageItems, i);
                        const rowStyle: React.CSSProperties = {
                          borderBottom: '1px solid #e2e8f0',
                        };

                        return (
                          <tr
                            key={`${item.id}-${i}`}
                            style={{ ...rowStyle, height: '24px', backgroundColor: '#ffffff' }}
                          >
                            {/* rowSpan for Category Column */}
                            {rowSpan > 0 && (
                              <td
                                rowSpan={rowSpan}
                                style={{ ...cellStyles.category, verticalAlign: 'middle' }}
                              >
                                {item.category}
                              </td>
                            )}

                            <td style={cellStyles.name} title={item.name}>
                              {item.name}
                            </td>

                            {/* 12 Months Usage */}
                            {item.monthsUsage.map((usage: number, mIdx: number) => {
                              const isActive = usage > 0;
                              return (
                                <td
                                  key={mIdx}
                                  style={
                                    isActive
                                      ? cellStyles.valueActive
                                      : { ...cellStyles.value, color: '#94a3b8' } // gray out zero values for visual clarity
                                  }
                                >
                                  {formatUsage(usage)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Page Footer Section */}
              <div className="mt-2 pt-2 border-t border-slate-300 text-[9px] text-slate-500 flex justify-between items-center">
                <span>System: KDT Inventory Manager</span>
                <span className="font-bold">KDT</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Modal */}
      {alertModal && (
        <ConfirmationModal
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel="확인"
          onConfirm={() => setAlertModal(null)}
        />
      )}
    </div>
  );
};

export default MonthlyUsageReportModal;
