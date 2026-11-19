import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InventoryItem, MasterData } from '../types';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import ConfirmationModal from './ConfirmationModal';

interface ReportModalProps {
  items: InventoryItem[];
  masterData: MasterData;
  onClose: () => void;
  columnWidths: Record<string, number>;
}

// User Requirement: Reduced to 35 items per page for better A4 layout (Unified with Monthly Report)
const ROWS_PER_PAGE = 33;

const ReportModal: React.FC<ReportModalProps> = ({ items, masterData, onClose, columnWidths }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  // Field Labels State - Reverted to static
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let fields = DEFAULT_DB_FIELDS;
    try {
      const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
      if (saved) fields = JSON.parse(saved);
    } catch { }

    const labelMap: Record<string, string> = {};
    fields.forEach(f => {
      labelMap[f.key] = f.label;
    });
    setLabels(labelMap);
  }, []);

  const getLabel = (key: string, defaultVal: string) => labels[key] || defaultVal;
  const formatOneDecimal = (value: any) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && !Number.isNaN(value)) return value.toFixed(1);
    if (typeof value === 'string') {
      const trimmed = value.replace(/,/g, '').trim();
      if (trimmed === '') return '';
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        if (!Number.isNaN(num)) return num.toFixed(1);
      }
    }
    return String(value);
  };

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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
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
  }, [items, categoryOrderMap, nameOrderMap]);

  // Pagination Logic
  const pages = useMemo(() => {
    const chunks: InventoryItem[][] = [];
    for (let i = 0; i < sortedItems.length; i += ROWS_PER_PAGE) {
      chunks.push(sortedItems.slice(i, i + ROWS_PER_PAGE));
    }
    return chunks;
  }, [sortedItems]);

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: '재고현황보고서',
  });

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // Calculate percentages based on the pixel widths passed from the main view
  const calculateWidthPercent = (key: string) => {
    const validKeys = ['no', 'category', 'name', 'pkgUnit', 'pkgType', 'outerPkg', 'currentStock', 'unit', 'location', 'note'];
    const noteWidth = 100;
    const totalPx = validKeys.reduce((sum, k) => {
      const w = columnWidths[k as any] || (k === 'note' ? noteWidth : 0);
      return sum + w;
    }, 0);
    const targetWidth = columnWidths[key as any] || (key === 'note' ? noteWidth : 0);
    return `${(targetWidth / totalPx) * 100}%`;
  };

  // 대분류 rowspan 계산 (미리보기용 병합 셀)
  const getCategoryRowSpan = (pageItems: InventoryItem[], currentIndex: number) => {
    const currentCategory = pageItems[currentIndex].category;
    if (currentIndex > 0 && pageItems[currentIndex - 1].category === currentCategory) {
      return 0; // 이전 행의 rowspan에 포함됨
    }
    let count = 1;
    for (let i = currentIndex + 1; i < pageItems.length; i++) {
      if (pageItems[i].category === currentCategory) count++;
      else break;
    }
    return count;
  };

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
    borderRight: '1px solid #cbd5e1', // slate-300
    borderTop: '2px solid #1e293b', // slate-800 (Title Line)
    borderBottom: '1px solid #1e293b', // slate-800 (Header Line)
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f172a', // slate-900
    display: 'table-cell'
  };

  const cellStyles = {
    no: { ...commonCellStyle, textAlign: 'center', color: '#64748b' } as React.CSSProperties,
    category: { ...commonCellStyle, textAlign: 'center', fontWeight: '600', color: '#0f172a' } as React.CSSProperties,
    name: { ...commonCellStyle, textAlign: 'left', fontWeight: '500', color: '#1e293b' } as React.CSSProperties,
    spec: { ...commonCellStyle, textAlign: 'center', color: '#475569' } as React.CSSProperties,
    stock: { ...commonCellStyle, textAlign: 'right', fontWeight: 'bold' } as React.CSSProperties,
    unit: { ...commonCellStyle, textAlign: 'center', color: '#334155' } as React.CSSProperties,
    location: { ...commonCellStyle, textAlign: 'center', color: '#475569' } as React.CSSProperties,
    note: { ...commonCellStyle, textAlign: 'center', color: '#64748b', borderRight: 'none' } as React.CSSProperties
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto p-4 custom-scrollbar print-modal-overlay">

      {/* Controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-[110] no-print">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-medium transition-colors"
        >
          <Printer size={18} />
          보고서 인쇄
        </button>
        <button
          onClick={onClose}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
        >
          <X size={18} />
          닫기
        </button>
      </div>

      {/* Pages Container */}
      <div ref={contentRef} className="flex flex-col gap-8 my-8 items-center print:block print:w-full print:m-0 print:p-0">
        {pages.map((pageItems, pageIndex) => {
          const startIndex = pageIndex * ROWS_PER_PAGE;

          return (
            <div
              key={pageIndex}
              id={`page-${pageIndex}`}
              className="print-page bg-white text-slate-900 w-full shadow-2xl relative flex flex-col justify-between mx-auto mb-8 print:mb-0 print:shadow-none"
              style={{ pageBreakAfter: 'always', padding: '15mm 10mm' }}
            >
              <div className="flex-1">
                {/* Header */}
                <div className="mb-2 border-b-2 border-slate-800 pb-2">
                  <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">재고 현황 보고서</h1>
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-700">KDT</span>
                    <span className="text-[10px] text-slate-500 font-medium">출력일: {today}</span>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse table-fixed text-[12px]">
                  <colgroup>
                    <col style={{ width: calculateWidthPercent('no') }} />
                    <col style={{ width: calculateWidthPercent('category') }} />
                    <col style={{ width: calculateWidthPercent('name') }} />
                    <col style={{ width: calculateWidthPercent('pkgUnit') }} />
                    <col style={{ width: calculateWidthPercent('pkgType') }} />
                    <col style={{ width: calculateWidthPercent('outerPkg') }} />
                    <col style={{ width: calculateWidthPercent('currentStock') }} />
                    <col style={{ width: calculateWidthPercent('unit') }} />
                    <col style={{ width: calculateWidthPercent('location') }} />
                    <col style={{ width: calculateWidthPercent('note') }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th style={headerCellStyle}>No</th>
                      <th style={headerCellStyle}>{getLabel('category', '대분류')}</th>
                      <th style={headerCellStyle}>{getLabel('name', '품목명')}</th>
                      <th style={headerCellStyle}>{getLabel('pkgUnit', '포장단위')}</th>
                      <th style={headerCellStyle}>{getLabel('pkgType', '소포장 개수')}</th>
                      <th style={headerCellStyle}>{getLabel('outerPkg', '박스구성')}</th>
                      <th style={headerCellStyle}>{getLabel('currentStock', '잔량')}</th>
                      <th style={headerCellStyle}>{getLabel('unit', '단위')}</th>
                      <th style={headerCellStyle}>{getLabel('location', '보관장소')}</th>
                      <th style={{ ...headerCellStyle, borderRight: 'none' }}>{getLabel('note', '비고')}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageItems.map((item, i) => {
                      const isLowStock = item.currentStock < item.safeStock;
                      const rowSpan = getCategoryRowSpan(pageItems, i);
                      const rowStyle: React.CSSProperties = {
                        borderBottom: '1px solid #e2e8f0'
                      };

                      return (
                        <tr key={item.id} style={{ ...rowStyle, height: '25px', backgroundColor: '#ffffff' }}>
                          <td style={cellStyles.no}>{startIndex + i + 1}</td>

                          {/* Native Printing handles rowspan correctly */}
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
                          <td style={cellStyles.spec}>{item.pkgUnit ? formatOneDecimal(item.pkgUnit) : '-'}</td>
                          <td style={cellStyles.spec}>{item.pkgType || '-'}</td>
                          <td style={cellStyles.spec}>{item.outerPkg ? formatOneDecimal(item.outerPkg) : '-'}</td>

                          <td style={{ ...cellStyles.stock, color: isLowStock ? '#dc2626' : '#1e293b' }}>
                            {formatOneDecimal(item.currentStock)}
                          </td>

                          <td style={cellStyles.unit}>{item.unit}</td>
                          <td style={cellStyles.location}>{item.location}</td>
                          <td style={cellStyles.note}>{item.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Page Footer */}
              <div className="mt-1 pt-2 border-t border-slate-300">
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>KDT 재고관리 시스템</span>
                  <span>- Page {pageIndex + 1} / {pages.length} -</span>
                </div>
                {/* User Requested: Summary section removed */}
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

export default ReportModal;
