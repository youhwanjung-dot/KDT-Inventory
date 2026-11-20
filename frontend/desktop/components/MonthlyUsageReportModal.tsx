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
  viewMode: 'ANNUAL' | 'ZONE';
  onClose: () => void;
}

const ROWS_PER_PAGE = 50;
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
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedZone, setSelectedZone] = useState(masterData.categories[0] || '');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [previewScale, setPreviewScale] = useState(0.5);

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

  useEffect(() => {
    if (viewMode === 'ZONE' && !masterData.categories.includes(selectedZone)) {
      setSelectedZone(masterData.categories[0] || '');
    }
  }, [viewMode, masterData.categories, selectedZone]);

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

  // Extract all IN/OUT transactions in the selected year
  const yearTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.type !== 'IN' && tx.type !== 'OUT') return false;
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

  // Calculate monthly usage (IN/OUT sum) for each item in the selected year
  const reportData = useMemo(() => {
    const calculated = mergedItems.map((item) => {
      const monthsUsage = Array(12).fill(0).map(() => ({ in: 0, out: 0 }));
      let annualIn = 0;
      let annualOut = 0;

      for (let m = 1; m <= 12; m++) {
        const prefix = `${selectedYear}-${String(m).padStart(2, '0')}`;
        const monthTxs = yearTxs.filter((tx) => tx.itemId === item.id && tx.date.startsWith(prefix));
        const monthIn = roundToOneDecimal(monthTxs.filter(tx => tx.type === 'IN').reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0));
        const monthOut = roundToOneDecimal(monthTxs.filter(tx => tx.type === 'OUT').reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0));
        monthsUsage[m - 1] = { in: monthIn, out: monthOut };
        annualIn = roundToOneDecimal(annualIn + monthIn);
        annualOut = roundToOneDecimal(annualOut + monthOut);
      }

      return {
        ...item,
        monthsUsage,
        annualIn,
        annualOut,
      };
    });

    // Filters: Search Term & Usage presence
    const filtered = calculated.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = activeOnly ? (row.annualIn > 0 || row.annualOut > 0) : true;
      const matchesZone = viewMode !== 'ZONE' || row.category === selectedZone;
      return matchesSearch && matchesActive && matchesZone;
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
  }, [mergedItems, yearTxs, selectedYear, activeOnly, searchTerm, categoryOrderMap, nameOrderMap, viewMode, selectedZone]);

  // ZONE mode: yearly aggregate (startStock / totalIn / totalOut / endStock) for the selected ZONE,
  // matching the column format of MonthlyReportModal.
  const zoneReportData = useMemo(() => {
    if (viewMode !== 'ZONE') return [];

    const itemsById = new Map(items.map((it) => [it.id, it]));

    const calculated = mergedItems.map((item) => {
      const invItem = itemsById.get(item.id);
      const currentStock = invItem ? Number(invItem.currentStock) || 0 : 0;
      const unit = invItem?.unit || item.unit || 'EA';
      const location = invItem?.location || '';

      const itemYearTxs = yearTxs.filter((tx) => tx.itemId === item.id);
      const totalIn = Math.round(
        itemYearTxs.filter((tx) => tx.type === 'IN').reduce((s, tx) => s + (Number(tx.quantity) || 0), 0)
      );
      const totalOut = Math.round(
        itemYearTxs.filter((tx) => tx.type === 'OUT').reduce((s, tx) => s + (Number(tx.quantity) || 0), 0)
      );

      const startStock = Math.round(currentStock - (totalIn - totalOut));
      const endStock = currentStock;

      return { ...item, currentStock, unit, location, startStock, totalIn, totalOut, endStock };
    });

    const filtered = calculated.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = activeOnly ? row.totalIn > 0 || row.totalOut > 0 : true;
      return row.category === selectedZone && matchesSearch && matchesActive;
    });

    return filtered.sort((a, b) => {
      const orderNameA = nameOrderMap.get(a.name);
      const orderNameB = nameOrderMap.get(b.name);
      if (orderNameA !== undefined && orderNameB !== undefined && orderNameA !== orderNameB) {
        return orderNameA - orderNameB;
      }
      if (orderNameA !== undefined && orderNameB === undefined) return -1;
      if (orderNameA === undefined && orderNameB !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [viewMode, mergedItems, yearTxs, items, selectedZone, searchTerm, activeOnly, nameOrderMap]);

  // Pagination for print view
  const pages = useMemo(() => {
    if (viewMode === 'ZONE') {
      const chunks = [];
      const rowsPerPage = 40;
      for (let i = 0; i < zoneReportData.length; i += rowsPerPage) {
        chunks.push(zoneReportData.slice(i, i + rowsPerPage));
      }
      if (chunks.length === 0) return [[]];
      return chunks;
    }
    const chunks = [];
    for (let i = 0; i < reportData.length; i += ROWS_PER_PAGE) {
      chunks.push(reportData.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) return [[]];
    return chunks;
  }, [reportData, zoneReportData, viewMode]);

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: viewMode === 'ZONE'
      ? `${selectedYear}년_${selectedZone}_ZONE사용현황보고서`
      : `${selectedYear}년_연간사용현황보고서`,
    pageStyle: usageReportPageStyle,
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
      color: '#ea580c', // highlight non-zero values in orange
    } as React.CSSProperties,
  };

  // ZONE table cell styles (matches MonthlyReportModal: 33px row, 14px font)
  const zoneCommonCellStyle: React.CSSProperties = {
    padding: '2px 4px',
    height: '33px',
    verticalAlign: 'middle',
    borderRight: '1px solid #f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    fontFamily: "'Noto Sans KR', sans-serif",
  };
  const zoneHeaderCellStyle: React.CSSProperties = {
    ...zoneCommonCellStyle,
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
  const zoneCellStyles = {
    no: { ...zoneCommonCellStyle, textAlign: 'center', color: '#64748b' } as React.CSSProperties,
    category: { ...zoneCommonCellStyle, textAlign: 'center', fontWeight: '600', color: '#0f172a' } as React.CSSProperties,
    name: { ...zoneCommonCellStyle, textAlign: 'left', fontWeight: '500', color: '#1e293b' } as React.CSSProperties,
    unit: { ...zoneCommonCellStyle, textAlign: 'center', color: '#334155' } as React.CSSProperties,
    stock: { ...zoneCommonCellStyle, textAlign: 'right', fontWeight: 'bold' } as React.CSSProperties,
    location: { ...zoneCommonCellStyle, textAlign: 'center', color: '#475569' } as React.CSSProperties,
  };

  const fmtInt = (v: number) => {
    const n = Math.round(Number(v) || 0);
    return n === 0 ? '' : n.toLocaleString('ko-KR');
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
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-orange-500"
          >
            {yearsOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
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
                {masterData.categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
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
            placeholder="품목명 검색..."
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
            사용량 있는 품목만
          </span>
          <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
            {viewMode === 'ZONE' ? zoneReportData.length : reportData.length}건
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
        className="flex flex-col my-12 items-center print:block print:w-full print:m-0 print:p-0"
        style={{ gap: `${32 * previewScale}px` }}
      >
        {pages.map((pageItems, pageIndex) => {
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
                    {viewMode === 'ZONE' ? `${selectedZone} ZONE 사용현황 보고서` : '연간 사용현황 보고서'}
                  </h1>
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
                {viewMode === 'ZONE' ? (
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
                        <th style={zoneHeaderCellStyle}>No</th>
                        <th style={zoneHeaderCellStyle}>{getLabel('category', '대분류')}</th>
                        <th style={zoneHeaderCellStyle}>{getLabel('name', '품목명')}</th>
                        <th style={zoneHeaderCellStyle}>{getLabel('unit', '단위')}</th>
                        <th style={zoneHeaderCellStyle}>기초재고</th>
                        <th style={{ ...zoneHeaderCellStyle, color: '#1d4ed8', backgroundColor: '#eff6ff' }}>입고</th>
                        <th style={{ ...zoneHeaderCellStyle, color: '#b91c1c', backgroundColor: '#fef2f2' }}>출고</th>
                        <th style={zoneHeaderCellStyle}>기말재고</th>
                        <th style={zoneHeaderCellStyle}>{getLabel('location', '장소')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item: any, i: number) => (
                        <tr key={`${item.id}-${i}`} style={{ height: '33px', backgroundColor: '#ffffff' }}>
                          <td style={zoneCellStyles.no}>{i + 1}</td>
                          {i === 0 && (
                            <td rowSpan={pageItems.length} style={{ ...zoneCellStyles.category, verticalAlign: 'middle' }}>
                              {selectedZone}
                            </td>
                          )}
                          <td style={zoneCellStyles.name} title={item.name}>{item.name}</td>
                          <td style={zoneCellStyles.unit}>{item.unit}</td>
                          <td style={{ ...zoneCellStyles.stock, backgroundColor: '#f8fafc' }}>{fmtInt(item.startStock)}</td>
                          <td style={{ ...zoneCellStyles.stock, color: '#2563eb' }}>{fmtInt(item.totalIn)}</td>
                          <td style={{ ...zoneCellStyles.stock, color: '#dc2626' }}>{fmtInt(item.totalOut)}</td>
                          <td style={{ ...zoneCellStyles.stock, backgroundColor: '#f8fafc' }}>{fmtInt(item.endStock)}</td>
                          <td style={zoneCellStyles.location}>{item.location || '-'}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 40 - pageItems.length) }).map((_, idx) => (
                        <tr
                          key={`empty-${pageIndex}-${idx}`}
                          style={{ height: '33px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
                        >
                          <td style={zoneCellStyles.no}>{pageItems.length + idx + 1}</td>
                          <td style={zoneCellStyles.category}></td>
                          <td style={zoneCellStyles.name}></td>
                          <td style={zoneCellStyles.unit}></td>
                          <td style={{ ...zoneCellStyles.stock, backgroundColor: '#f8fafc' }}></td>
                          <td style={{ ...zoneCellStyles.stock, color: '#2563eb' }}></td>
                          <td style={{ ...zoneCellStyles.stock, color: '#dc2626' }}></td>
                          <td style={{ ...zoneCellStyles.stock, backgroundColor: '#f8fafc' }}></td>
                          <td style={zoneCellStyles.location}></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
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
                    <tr style={{ height: '36px' }}>
                      <th style={headerCellStyle} rowSpan={2}>{getLabel('category', '대분류')}</th>
                      <th style={headerCellStyle} rowSpan={2}>{getLabel('name', '품목명')}</th>
                      {Array.from({ length: 12 }, (_, m) => (
                        <th
                          key={m}
                          style={{ ...headerCellStyle, ...(m === 11 ? { borderRight: 'none' } : {}) }}
                        >
                          <div style={{ lineHeight: '1.1' }}>
                            <div style={{ fontSize: '11px' }}>{m + 1}월</div>
                            <div style={{ fontSize: '8px', fontWeight: '400', color: '#64748b' }}>입/출</div>
                          </div>
                        </th>
                      ))}
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
                            style={{ ...rowStyle, height: '36px', backgroundColor: '#ffffff' }}
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

                            {/* 12 Months Usage (IN / OUT) */}
                            {item.monthsUsage.map((usage: { in: number; out: number }, mIdx: number) => {
                              const isActive = usage.in > 0 || usage.out > 0;
                              return (
                                <td
                                  key={mIdx}
                                  style={
                                    isActive
                                      ? { ...cellStyles.value, padding: '2px 1px' }
                                      : { ...cellStyles.value, padding: '2px 1px', color: '#94a3b8' }
                                  }
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.15' }}>
                                    <span style={{ color: isActive ? '#2563eb' : '#94a3b8', fontSize: '9px', fontWeight: isActive ? '600' : '400' }}>
                                      {formatUsage(usage.in)}
                                    </span>
                                    <span style={{ color: isActive ? '#dc2626' : '#94a3b8', fontSize: '9px', fontWeight: isActive ? '600' : '400' }}>
                                      {formatUsage(usage.out)}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
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
