import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Calendar, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InventoryItem, InventoryTransaction, MasterData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { roundToOneDecimal } from '../utils/formatters';

interface MonthlyReportModalProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  onClose: () => void;
  columnWidths?: Record<string, number>; // Make optional to prevent breakage if not passed
}

// User Requirement: Reduced to 35 items per page for better A4 layout
const ROWS_PER_PAGE = 33;

const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ items, transactions, masterData, onClose, columnWidths = {} }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isGenerating, setIsGenerating] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false); // [NEW] 입출고 있는 항목만 필터
  const contentRef = useRef<HTMLDivElement>(null);
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

  const getLabel = (key: string, defaultVal: string) => labels[key] || defaultVal;

  // Build order maps from masterData prop (Firestore source of truth)
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

  // --- Report Data Calculation ---
  const reportData = useMemo(() => {
    const startDate = `${selectedMonth}-01`;

    // Calculate next month start date
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonthDate = new Date(year, month, 1);
    const nextMonthStr = nextMonthDate.toISOString().slice(0, 10);

    const calculated = items.map(item => {
      const itemTrans = transactions.filter(t => t.itemId === item.id);

      // Transactions strictly within the selected month
      const monthTrans = itemTrans.filter(t => t.date >= startDate && t.date < nextMonthStr);
      const totalIn = roundToOneDecimal(monthTrans.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0));
      const totalOut = roundToOneDecimal(monthTrans.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0));

      // Back-calculate End Stock from Current Stock
      // End Stock (of selected month) = Current Stock - (Transactions after selected month)
      // Reverse Logic: 
      // If a transaction happened later (Future IN), we subtract it to go back in time.
      // If a transaction happened later (Future OUT), we add it back.
      const futureTrans = itemTrans.filter(t => t.date >= nextMonthStr);
      let endStock = roundToOneDecimal(item.currentStock, 0);

      futureTrans.forEach(t => {
        if (t.type === 'IN') endStock -= t.quantity;
        else endStock += t.quantity;
      });
      endStock = roundToOneDecimal(endStock, 0);

      // Start Stock = End Stock - Total In + Total Out
      const startStock = roundToOneDecimal(endStock - totalIn + totalOut, 0);

      return {
        ...item,
        startStock,
        totalIn,
        totalOut,
        endStock
      };
    })
      // Filter items with no activity/stock relevant to this month
      .filter(row => row.startStock !== 0 || row.totalIn !== 0 || row.totalOut !== 0 || row.endStock !== 0)
      // [NEW] Optional: filter to show only items with actual in/out transactions this month
      .filter(row => filterActiveOnly ? (row.totalIn > 0 || row.totalOut > 0) : true);

    // Sort by Category then Name
    return calculated.sort((a, b) => {
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
  }, [items, transactions, selectedMonth, categoryOrderMap, nameOrderMap, filterActiveOnly]);

  // --- Pagination ---
  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < reportData.length; i += ROWS_PER_PAGE) {
      chunks.push(reportData.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) return [[]]; // Return at least one empty page
    return chunks;
  }, [reportData]);

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `월별재고수불현황_${selectedMonth}`,
  });

  const formattedMonth = `${selectedMonth.split('-')[0]}년 ${selectedMonth.split('-')[1]}월`;

  // Explicit Styles
  const commonCellStyle: React.CSSProperties = {
    padding: '4px 4px',
    height: '25px',
    verticalAlign: 'middle',
    borderRight: '1px solid #f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '12px',
    fontFamily: "'Noto Sans KR', sans-serif"
  };

  const headerCellStyle: React.CSSProperties = {
    ...commonCellStyle,
    height: '32px', // Explicit header height
    backgroundColor: '#f1f5f9', // slate-100
    borderRight: '1px solid #cbd5e1', // slate-300 for clearer grid
    borderTop: '2px solid #1e293b', // slate-800 (Title Line: 2px)
    borderBottom: '1px solid #1e293b', // slate-800 (Header Line: 1px)
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a', // slate-900
    display: 'table-cell'
  };

  // Cell Styles with Specific Colors to match Tailwind Logic
  const cellStyles = {
    no: { ...commonCellStyle, textAlign: 'center', color: '#64748b' } as React.CSSProperties, // slate-500
    category: { ...commonCellStyle, textAlign: 'center', fontWeight: '600', color: '#0f172a' } as React.CSSProperties, // slate-900
    name: { ...commonCellStyle, textAlign: 'left', fontWeight: '500', color: '#1e293b' } as React.CSSProperties, // slate-800
    spec: { ...commonCellStyle, textAlign: 'center', color: '#475569' } as React.CSSProperties, // slate-600
    stock: { ...commonCellStyle, textAlign: 'right', fontWeight: 'bold' } as React.CSSProperties,
    unit: { ...commonCellStyle, textAlign: 'center', color: '#334155' } as React.CSSProperties, // slate-700
    location: { ...commonCellStyle, textAlign: 'center', color: '#475569' } as React.CSSProperties, // slate-600
    note: { ...commonCellStyle, textAlign: 'center', color: '#64748b', borderRight: 'none' } as React.CSSProperties // slate-500
  };

  // 대분류 rowspan 계산 (미리보기용 병합 셀)
  const getCategoryRowSpan = (pageItems: any[], currentIndex: number) => {
    const currentCategory = pageItems[currentIndex].category;
    if (currentIndex > 0 && pageItems[currentIndex - 1].category === currentCategory) {
      return 0;
    }
    let count = 1;
    for (let i = currentIndex + 1; i < pageItems.length; i++) {
      if (pageItems[i].category === currentCategory) count++;
      else break;
    }
    return count;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto p-4 custom-scrollbar print-modal-overlay">

      {/* Top Controls */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg z-[110] border border-slate-200 dark:border-slate-700 no-print">
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">기간:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>

        {/* [NEW] 입출고 항목만 필터 체크박스 */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            id="filterActiveOnly"
            checked={filterActiveOnly}
            onChange={(e) => setFilterActiveOnly(e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span className={`text-sm font-medium transition-colors ${
            filterActiveOnly
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-300'
          }`}>
            입출고 있는 항목만
          </span>
          {filterActiveOnly && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
              {reportData.length}건
            </span>
          )}
        </label>

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-2 text-sm font-bold transition-colors"
        >
          <Printer size={16} />
          수불부 인쇄
        </button>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2"
        >
          <X size={20} />
        </button>
      </div>

      {/* Pages Container */}
      <div ref={contentRef} className="flex flex-col gap-8 my-12 items-center print:block print:w-full print:m-0 print:p-0">
        {pages.map((pageItems, pageIndex) => {
          const startIndex = pageIndex * ROWS_PER_PAGE;

          return (
            <div
              key={pageIndex}
              className="print-page bg-white text-slate-900 w-full shadow-2xl relative flex flex-col justify-between mx-auto mb-8 print:mb-0 print:shadow-none"
              style={{ pageBreakAfter: 'always', padding: '15mm 10mm' }}
            >
              <div className="flex-1">
                {/* Header */}
                <div className="mb-2 border-b-2 border-slate-800 pb-2">
                  <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">월별 재고 수불 현황</h1>
                  <div className="flex justify-between items-end mt-4">
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">기관명: KDT</p>
                      <p className="text-sm font-bold text-slate-700">대상기간: {formattedMonth}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">출력일자: {new Date().toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-500">Page {pageIndex + 1} / {pages.length}</p>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-[12px] border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '5%' }} />  {/* No */}
                    <col style={{ width: '13%' }} /> {/* Category */}
                    <col style={{ width: '26%' }} /> {/* Name */}
                    <col style={{ width: '6%' }} />  {/* Unit */}
                    <col style={{ width: '10%' }} /> {/* Start */}
                    <col style={{ width: '10%' }} /> {/* In */}
                    <col style={{ width: '10%' }} /> {/* Out */}
                    <col style={{ width: '10%' }} /> {/* End */}
                    <col style={{ width: '10%' }} />  {/* Location */}
                  </colgroup>
                  <thead>
                    <tr style={{ height: '32px' }}>
                      <th style={headerCellStyle}>No</th>
                      <th style={headerCellStyle}>{getLabel('category', '대분류')}</th>
                      <th style={headerCellStyle}>{getLabel('name', '품목명')}</th>
                      <th style={headerCellStyle}>{getLabel('unit', '단위')}</th>
                      <th style={headerCellStyle}>기초재고</th>
                      <th style={{ ...headerCellStyle, color: '#1d4ed8', backgroundColor: '#eff6ff' }}>입고</th>
                      <th style={{ ...headerCellStyle, color: '#b91c1c', backgroundColor: '#fef2f2' }}>출고</th>
                      <th style={headerCellStyle}>기말재고</th>
                      <th style={headerCellStyle}>{getLabel('location', '장소')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-20 text-slate-400 text-base border border-slate-300">해당 월에 데이터가 없습니다.</td></tr>
                    ) : (
                      pageItems.map((item, i) => {
                        const rowSpan = getCategoryRowSpan(pageItems, i);
                        const rowStyle: React.CSSProperties = {
                          borderBottom: '1px solid #e2e8f0'
                        };

                        return (
                          <tr key={`${item.id}-${i}`} style={{ ...rowStyle, height: '25px', backgroundColor: '#ffffff' }}>
                            <td style={cellStyles.no}>{startIndex + i + 1}</td>

                            {/* Native Printing handles rowspan correctly */}
                            {rowSpan > 0 && (
                              <td rowSpan={rowSpan} style={{ ...cellStyles.category, verticalAlign: 'middle' }}>
                                {item.category}
                              </td>
                            )}
                            <td style={cellStyles.name}>{item.name}</td>
                            <td style={cellStyles.unit}>{item.unit}</td>

                            <td style={{ ...cellStyles.stock, backgroundColor: '#f8fafc' }}>{Number(item.startStock).toFixed(1)}</td>

                            {/* Removed Background Color for IN/OUT, Kept text color for legibility */}
                            <td style={{ ...cellStyles.stock, color: '#2563eb' }}>
                              {item.totalIn > 0 ? Number(item.totalIn).toFixed(1) : '-'}
                            </td>
                            <td style={{ ...cellStyles.stock, color: '#dc2626' }}>
                              {item.totalOut > 0 ? Number(item.totalOut).toFixed(1) : '-'}
                            </td>

                            <td style={{ ...cellStyles.stock, backgroundColor: '#f8fafc' }}>{Number(item.endStock).toFixed(1)}</td>
                            <td style={cellStyles.location}>{item.location}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-0 pt-2 border-t border-slate-300 text-[9px] text-slate-500 flex justify-between items-center">
                <span>System: KDT Inventory Manager</span>
                <span className="font-bold">KDT</span>
              </div>
            </div>
          );
        })}
      </div>
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

export default MonthlyReportModal;
