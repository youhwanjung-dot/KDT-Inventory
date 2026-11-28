import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Calendar, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InventoryItem, InventoryTransaction, MasterData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { roundToOneDecimal } from '../utils/formatters';
import { compareCategoryWithOrder, sortInventoryItems } from '../utils/inventorySort';

interface MonthlyReportModalProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  onClose: () => void;
  columnWidths?: Record<string, number>; // Make optional to prevent breakage if not passed
}

const SLOTS_PER_CATEGORY = 40;
const A3_PAGE_WIDTH_PX = 297 * 96 / 25.4;
const A3_PAGE_HEIGHT_PX = 420 * 96 / 25.4;
const monthlyReportPageStyle = `
  @page monthly-report {
    size: A3 portrait;
    margin: 10mm;
  }
  @media print {
    .monthly-report-preview-sheet {
      display: contents !important;
      zoom: 1 !important;
    }
    .print-page.monthly-report-print-page {
      page: monthly-report;
      width: 277mm !important;
      max-width: 277mm !important;
      height: 400mm !important;
      max-height: 400mm !important;
      padding: 8mm !important;
      box-sizing: border-box !important;
    }
  }
`;

const getCurrentLocalMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ items, transactions, masterData, onClose, columnWidths = {} }) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentLocalMonth); // YYYY-MM in local time
  const [previewScale, setPreviewScale] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const updatePreviewScale = () => {
      const availableWidth = Math.max(0, window.innerWidth - 32);
      const availableHeight = Math.max(0, window.innerHeight - 180);
      const scale = Math.min(
        1,
        availableWidth / A3_PAGE_WIDTH_PX,
        availableHeight / A3_PAGE_HEIGHT_PX
      );
      setPreviewScale(Math.max(0.1, scale));
    };

    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, []);

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

  // --- Report Data Calculation ---
  const reportData = useMemo(() => {
    const startDate = `${selectedMonth}-01`;

    // Calculate next month start date
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonthDate = new Date(Date.UTC(year, month, 1));
    const nextMonthStr = nextMonthDate.toISOString().slice(0, 10);

    const calculated = items.map(item => {
      const itemTrans = transactions.filter(t => t.itemId === item.id);
      const carryOvers = itemTrans
        .filter(t => t.reason === '재고이월')
        .sort((a, b) => b.date.localeCompare(a.date));
      const stockMovements = itemTrans.filter(t => t.reason !== '재고이월');

      // Carry-over rows establish opening stock; they are not monthly receipts.
      const monthTrans = stockMovements.filter(t => t.date >= startDate && t.date < nextMonthStr);
      const totalIn = roundToOneDecimal(monthTrans.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0));
      const totalOut = roundToOneDecimal(monthTrans.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0));

      const netMovement = (movements: typeof stockMovements) =>
        movements.reduce((sum, t) => sum + (t.type === 'IN' ? t.quantity : -t.quantity), 0);
      const carryAtOrBeforeMonth = carryOvers.find(t => t.date <= startDate);
      const carryAfterMonth = [...carryOvers]
        .reverse()
        .find(t => t.date >= nextMonthStr);

      let startStock: number;
      if (carryAtOrBeforeMonth) {
        const movementsSinceCarry = stockMovements.filter(
          t => t.date >= carryAtOrBeforeMonth.date && t.date < startDate
        );
        startStock = carryAtOrBeforeMonth.quantity + netMovement(movementsSinceCarry);
      } else if (carryAfterMonth) {
        const movementsBeforeCarry = stockMovements.filter(
          t => t.date >= startDate && t.date < carryAfterMonth.date
        );
        startStock = carryAfterMonth.quantity - netMovement(movementsBeforeCarry);
      } else {
        const movementsAfterMonthStart = stockMovements.filter(t => t.date >= startDate);
        startStock = item.currentStock - netMovement(movementsAfterMonthStart);
      }
      startStock = roundToOneDecimal(startStock, 0);
      const endStock = roundToOneDecimal(startStock + totalIn - totalOut, 0);

      return {
        ...item,
        startStock,
        totalIn,
        totalOut,
        endStock
      };
    });

    return sortInventoryItems(calculated, categoryOrderMap);
  }, [items, transactions, selectedMonth, categoryOrderMap]);

  // Keep one fixed 40-slot page for every configured category.
  const pages = useMemo(() => {
    const categories = [...new Set([
      ...masterData.categories,
      ...items.map(item => item.category).filter(Boolean)
    ])].sort((a, b) => {
      return compareCategoryWithOrder(a, b, categoryOrderMap);
    });
    const pageCategories = categories.length > 0 ? categories : [''];

    return pageCategories.flatMap(category => {
      const categoryItems = reportData
        .filter(item => item.category === category)
        .filter(item => !filterActiveOnly || item.totalIn > 0 || item.totalOut > 0);
      const pageCount = Math.max(1, Math.ceil(categoryItems.length / SLOTS_PER_CATEGORY));

      return Array.from({ length: pageCount }, (_, pageIndex) => {
        const pageItems = categoryItems.slice(
          pageIndex * SLOTS_PER_CATEGORY,
          (pageIndex + 1) * SLOTS_PER_CATEGORY
        );
        const slots: Array<(typeof reportData)[number] | {
          id: string;
          category: string;
          name: string;
          unit: string;
          location: string;
          startStock: number;
          totalIn: number;
          totalOut: number;
          endStock: number;
        }> = [...pageItems];

        while (slots.length < SLOTS_PER_CATEGORY) {
          const slot = slots.length + 1;
          slots.push({
            id: `empty-${category}-${pageIndex}-${slot}`,
            category,
            name: '',
            unit: '',
            location: '',
            startStock: 0,
            totalIn: 0,
            totalOut: 0,
            endStock: 0
          });
        }
        return { category, items: slots, zonePage: pageIndex + 1, zonePageCount: pageCount };
      });
    });
  }, [items, masterData.categories, categoryOrderMap, reportData, filterActiveOnly]);

  const activeItemCount = reportData.filter(item => item.totalIn > 0 || item.totalOut > 0).length;

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `월별재고수불현황_${selectedMonth}`,
    pageStyle: monthlyReportPageStyle,
  });

  const formattedMonth = `${selectedMonth.split('-')[0]}년 ${selectedMonth.split('-')[1]}월`;

  // Explicit Styles
  const commonCellStyle: React.CSSProperties = {
    padding: '2px 4px',
    height: '33px',
    verticalAlign: 'middle',
    borderRight: '1px solid #f1f5f9',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    fontFamily: "'Noto Sans KR', sans-serif"
  };

  const headerCellStyle: React.CSSProperties = {
    ...commonCellStyle,
    height: '40px',
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

        {/* Filter out items without transactions in the selected month. */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            id="filterActiveOnly"
            checked={filterActiveOnly}
            onChange={(e) => setFilterActiveOnly(e.target.checked)}
            className="w-4 h-4 accent-orange-600 cursor-pointer"
          />
          <span className={`text-sm font-medium transition-colors ${
            filterActiveOnly
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-slate-600 dark:text-slate-300'
          }`}>
            선택 월 입출고 품목만
          </span>
          {filterActiveOnly && (
            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-bold">
            {activeItemCount}건
            </span>
          )}
        </label>

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
        <button
          onClick={handlePrint}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-2 text-sm font-bold transition-colors"
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
      <div
        ref={contentRef}
        className="flex flex-col my-12 items-center print:block print:w-full print:m-0 print:p-0"
        style={{ gap: `${32 * previewScale}px` }}
      >
        {pages.map(({ category, items: pageItems, zonePage, zonePageCount }, pageIndex) => {
          return (
            <div
              key={pageIndex}
              className="monthly-report-preview-sheet flex-none bg-white shadow-2xl"
              style={{
                width: '297mm',
                height: '420mm',
                padding: '10mm',
                boxSizing: 'border-box',
                zoom: previewScale
              }}
            >
              <div
                className="print-page monthly-report-print-page bg-white text-slate-900 w-full h-full relative flex flex-col justify-between mx-auto print:shadow-none"
                style={{
                  pageBreakAfter: 'always',
                  width: '277mm',
                  height: '400mm',
                  padding: '8mm',
                  boxSizing: 'border-box'
                }}
              >
              <div className="flex-1">
                {/* Header */}
                <div className="mb-1 border-b-2 border-slate-800 pb-1">
                  <h1 className="text-[26px] font-bold text-center text-slate-900 mb-2">월별 재고 수불 현황</h1>
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">기관명: KDT</p>
                      <p className="text-sm font-bold text-slate-700">대상기간: {formattedMonth}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">출력일자: {new Date().toLocaleDateString()}</p>
                      {zonePageCount > 1 && (
                        <p className="text-[11px] text-slate-500">{category} 페이지: {zonePage} / {zonePageCount}</p>
                      )}
                      <p className="text-[11px] text-slate-500">Page {pageIndex + 1} / {pages.length}</p>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-[13px] border-collapse table-fixed">
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
                    <tr style={{ height: '40px' }}>
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
                    {pageItems.map((item, slotIndex) => {
                      const hasItem = Boolean(item.name);
                      return (
                        <tr key={`${item.id}-${slotIndex}`} style={{ height: '33px', backgroundColor: '#ffffff' }}>
                          <td style={cellStyles.no}>{slotIndex + 1}</td>
                          {slotIndex === 0 && (
                            <td rowSpan={SLOTS_PER_CATEGORY} style={{ ...cellStyles.category, verticalAlign: 'middle' }}>
                              {category}
                            </td>
                          )}
                          <td style={cellStyles.name}>{item.name}</td>
                          <td style={cellStyles.unit}>{item.unit}</td>
                          <td style={{ ...cellStyles.stock, backgroundColor: '#f8fafc' }}>
                            {hasItem ? Math.round(Number(item.startStock) || 0).toLocaleString('ko-KR') : ''}
                          </td>
                          <td style={{ ...cellStyles.stock, color: '#2563eb' }}>
                            {hasItem && item.totalIn > 0 ? Math.round(Number(item.totalIn) || 0).toLocaleString('ko-KR') : ''}
                          </td>
                          <td style={{ ...cellStyles.stock, color: '#dc2626' }}>
                            {hasItem && item.totalOut > 0 ? Math.round(Number(item.totalOut) || 0).toLocaleString('ko-KR') : ''}
                          </td>
                          <td style={{ ...cellStyles.stock, backgroundColor: '#f8fafc' }}>
                            {hasItem ? Math.round(Number(item.endStock) || 0).toLocaleString('ko-KR') : ''}
                          </td>
                          <td style={cellStyles.location}>{item.location}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-0 pt-1 border-t border-slate-300 text-[9px] text-slate-500 flex justify-between items-center">
                <span>System: KDT Inventory Manager</span>
                <span className="font-bold">KDT</span>
              </div>
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
