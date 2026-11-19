import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, Filter, FileDown, Printer, LayoutTemplate, Edit, AlertCircle, ChevronDown, XCircle, X, Trash2, CheckSquare, Square, Box, Calendar, History, RotateCcw, BarChart2, Loader2 } from 'lucide-react';
import { InventoryItem, InventoryTransaction, User, MasterData } from '../types';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import ReportModal from './ReportModal';
import ConfirmationModal from './ConfirmationModal';
import { ActionLogger } from '../utils/logger';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY } from '../constants';
import { formatOneDecimal, roundToOneDecimal } from '../utils/formatters';

interface InventoryListProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  user: User;
  initialFilterMode?: 'ALL' | 'LOW_STOCK';
  initialCategoryFilter?: string | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onOpenDBManager: () => void;
  onTransaction: (item: InventoryItem) => void;
  onOpenMonthlyReport: () => void;
  onOpenMonthlyUsageReport: () => void;
  onOpenReport: () => void;
}

interface ResizableThProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const ResizableTh: React.FC<ResizableThProps> = ({ width, onResizeStart, children, className = '', align = 'center' }) => (
  <th
    className={`relative px-2 py-3 select-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-sm whitespace-nowrap ${className}`}
    style={{ width, textAlign: align }}
  >
    <div className={`flex items-center h-full truncate ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {children}
    </div>
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 z-10 transition-colors"
      onMouseDown={onResizeStart}
    />
  </th>
);

const WIDTH_STORAGE_KEY = 'asan_inventory_col_widths_v2';

const DEFAULT_WIDTHS = {
  edit: 50,
  no: 60,
  category: 100,
  name: 240,
  pkgUnit: 80,
  pkgType: 80,
  outerPkg: 100,
  currentStock: 100,
  unit: 80,
  location: 120,
};


const InventoryList: React.FC<InventoryListProps> = ({ items, transactions, masterData, user, initialFilterMode = 'ALL', initialCategoryFilter = null, onAdd, onEdit, onDelete, onReset, onTransaction, onOpenDBManager, onOpenMonthlyReport, onOpenMonthlyUsageReport, onOpenReport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState<boolean>(initialFilterMode === 'LOW_STOCK');

  useEffect(() => {
    setShowOnlyLowStock(initialFilterMode === 'LOW_STOCK');
  }, [initialFilterMode]);

  // Multi-select Category State (Initialize with initialCategoryFilter if passed)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategoryFilter ? [initialCategoryFilter] : []);

  useEffect(() => {
    if (initialCategoryFilter) {
      setSelectedCategories([initialCategoryFilter]);
    }
  }, [initialCategoryFilter]);

  // 90-Day (3-Month) Transaction Stats for Accurate Safe Stock Calculation
  const item3MonthStats = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const map = new Map<string, { hasActivity: boolean; totalOut: number; monthlyAvg: number }>();

    transactions.forEach(tx => {
      if (!tx.date || tx.date < cutoffStr) return;
      const key = tx.itemId || tx.itemName;
      if (!key) return;

      const existing = map.get(key) || { hasActivity: false, totalOut: 0, monthlyAvg: 0 };
      existing.hasActivity = true;
      if (tx.type === 'OUT') {
        existing.totalOut += Number(tx.quantity || 0);
      }
      map.set(key, existing);
    });

    map.forEach(val => {
      val.totalOut = roundToOneDecimal(val.totalOut);
      val.monthlyAvg = roundToOneDecimal(val.totalOut / 3);
    });

    return map;
  }, [transactions]);

  // Count low stock items for badge
  const lowStockCount = useMemo(() => {
    const hasTxHistory = transactions.length > 0;
    return items.filter(item => {
      const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
      const hasRecentActivity = stats ? stats.hasActivity : false;
      const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
      const calculatedSafe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);

      const isLow = (item.currentStock ?? 0) < calculatedSafe;
      if (!isLow) return false;
      if (hasTxHistory && !hasRecentActivity) return false;
      return true;
    }).length;
  }, [items, item3MonthStats, transactions]);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [showReport, setShowReport] = useState(false);
  const [showLayoutReset, setShowLayoutReset] = useState(false);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  const getLabel = (key: string, defaultVal: string) => {
    try {
      const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
      if (saved) {
        const fields = JSON.parse(saved);
        const field = fields.find((f: any) => f.key === key);
        return field ? field.label : defaultVal;
      }
    } catch { }
    return defaultVal;
  };

  const [colWidths, setColWidths] = useState<typeof DEFAULT_WIDTHS>(() => {
    try {
      const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WIDTHS;
    } catch {
      return DEFAULT_WIDTHS;
    }
  });

  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resizingRef = useRef<{ key: keyof typeof DEFAULT_WIDTHS; startX: number; startWidth: number } | null>(null);

  // Build order maps from masterData prop (Firestore source of truth)
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    masterData.categories.forEach((c, i) => map.set(c, i));
    return map;
  }, [masterData]);

  const nameOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    let globalIdx = 0;
    masterData.categories.forEach(cat => {
      (masterData.namesByCategory[cat] || []).forEach(n => {
        if (!map.has(n)) {
          map.set(n, globalIdx++);
        }
      });
    });
    masterData.nameOrder.forEach(n => {
      if (!map.has(n)) {
        map.set(n, globalIdx++);
      }
    });
    return map;
  }, [masterData]);

  // 카테고리별 소분류 순서 맵 (같은 카테고리 내에서 정렬 시 사용)
  const namesByCategoryOrderMap = useMemo(() => {
    const catMap = new Map<string, Map<string, number>>();
    masterData.categories.forEach(cat => {
      const nMap = new Map<string, number>();
      (masterData.namesByCategory[cat] || []).forEach((n, idx) => {
        nMap.set(n, idx);
      });
      catMap.set(cat, nMap);
    });
    return catMap;
  }, [masterData]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    masterData.categories.forEach(c => set.add(c));
    items.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => {
      const orderA = categoryOrderMap.get(a);
      const orderB = categoryOrderMap.get(b);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [items, masterData, categoryOrderMap]);

  // Toggle single category
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Toggle all
  const toggleAllCategories = () => {
    if (selectedCategories.length === uniqueCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...uniqueCategories]);
    }
  };

  const filteredItems = useMemo(() => {
    const hasTxHistory = transactions.length > 0;

    const filtered = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);

      const matchesLowStock = !showOnlyLowStock || (() => {
        const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
        const hasRecentActivity = stats ? stats.hasActivity : false;
        const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
        const calculatedSafe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);

        const isLow = Number(item.currentStock ?? 0) < calculatedSafe;
        if (!isLow) return false;
        if (hasTxHistory && !hasRecentActivity) return false;
        return true;
      })();

      return matchesSearch && matchesCategory && matchesLowStock;
    });

    return filtered.sort((a, b) => {
      const orderCategoryA = categoryOrderMap.get(a.category);
      const orderCategoryB = categoryOrderMap.get(b.category);
      if (orderCategoryA !== undefined && orderCategoryB !== undefined && orderCategoryA !== orderCategoryB) {
        return orderCategoryA - orderCategoryB;
      }
      if (orderCategoryA !== undefined && orderCategoryB === undefined) return -1;
      if (orderCategoryA === undefined && orderCategoryB !== undefined) return 1;
      if (a.category !== b.category) return a.category.localeCompare(b.category);

      const catNameMap = namesByCategoryOrderMap.get(a.category);
      if (catNameMap) {
        const orderNameA = catNameMap.get(a.name);
        const orderNameB = catNameMap.get(b.name);
        if (orderNameA !== undefined && orderNameB !== undefined && orderNameA !== orderNameB) {
          return orderNameA - orderNameB;
        }
        if (orderNameA !== undefined && orderNameB === undefined) return -1;
        if (orderNameA === undefined && orderNameB !== undefined) return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [items, searchTerm, selectedCategories, showOnlyLowStock, item3MonthStats, transactions, categoryOrderMap, namesByCategoryOrderMap]);

  // Resizing logic
  const handleMouseDown = (e: React.MouseEvent, key: keyof typeof DEFAULT_WIDTHS) => {
    e.preventDefault();
    resizingRef.current = {
      key,
      startX: e.clientX,
      startWidth: colWidths[key]
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    setColWidths(prev => ({
      ...prev,
      [key]: Math.max(40, startWidth + diff)
    }));
  };

  const handleMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ show: boolean, isError: boolean, message: string }>({ show: false, isError: false, message: '' });

  const handleExportExcel = async () => {
    ActionLogger.log('Excel Export Initiated (Legacy Template)');
    try {
      setIsExporting(true);

      // --- Helpers ---
      const normalizeCategory = (value: string) => value.trim();
      const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
      const getNameOrder = (value: string) => {
        const order = nameOrderMap.get(value);
        return order === undefined || Number.isNaN(order) ? Number.MAX_SAFE_INTEGER : order;
      };
      const colToLetter = (col: number): string => {
        let letter = '';
        let c = col;
        while (c > 0) {
          const mod = (c - 1) % 26;
          letter = String.fromCharCode(65 + mod) + letter;
          c = Math.floor((c - 1) / 26);
        }
        return letter;
      };

      // 카테고리 시트당 30개 품목 슬롯 (4열 간격)
      const SLOT_COLS = [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 86, 90, 94, 98, 102, 106, 110, 114, 118];

      // --- 재고이월 데이터 ---
      const carryOverTxs = transactions.filter(tx => tx.reason === '재고이월');
      const carryOverYear = carryOverTxs.reduce((max, tx) => {
        const match = String(tx.date || '').match(/^(\d{4})-/);
        if (!match) return max;
        const year = Number(match[1]);
        return Number.isNaN(year) ? max : Math.max(max, year);
      }, 0);
      const targetCarryYear = carryOverYear || new Date().getFullYear();
      const carryOverByItemId = new Map<string, number>();
      carryOverTxs.forEach(tx => {
        const match = String(tx.date || '').match(/^(\d{4})-/);
        if (!match || Number(match[1]) !== targetCarryYear) return;
        const qty = Number(tx.quantity) || 0;
        carryOverByItemId.set(tx.itemId, (carryOverByItemId.get(tx.itemId) || 0) + qty);
      });

      // --- 내보내기 대상 아이템 ---
      const exportItems = selectedCategories.length > 0
        ? items.filter(item => selectedCategories.includes(item.category))
        : items;   // masterData 순서 정렬 (대분류 → 소분류, namesByCategory 기반)
      const sortedExportItems = [...exportItems].sort((a, b) => {
        const catOrderA = categoryOrderMap.get(a.category);
        const catOrderB = categoryOrderMap.get(b.category);
        if (catOrderA !== undefined && catOrderB !== undefined && catOrderA !== catOrderB) return catOrderA - catOrderB;
        if (catOrderA !== undefined && catOrderB === undefined) return -1;
        if (catOrderA === undefined && catOrderB !== undefined) return 1;
        const catCmp = (a.category || '').localeCompare(b.category || '');
        if (catCmp !== 0) return catCmp;
        // 같은 카테고리 내 namesByCategory 기반 정렬
        const catNameMap = namesByCategoryOrderMap.get(a.category);
        if (catNameMap) {
          const nameOrderA = catNameMap.get(a.name);
          const nameOrderB = catNameMap.get(b.name);
          if (nameOrderA !== undefined && nameOrderB !== undefined && nameOrderA !== nameOrderB) return nameOrderA - nameOrderB;
          if (nameOrderA !== undefined && nameOrderB === undefined) return -1;
          if (nameOrderA === undefined && nameOrderB !== undefined) return 1;
        }
        return normalizeText(a.name).localeCompare(normalizeText(b.name));
      });

      // --- 템플릿 로드 (캐시 무효화) ---
      const templateResponse = await fetch(`${import.meta.env.BASE_URL}template.xlsx?v=${Date.now()}`);
      if (!templateResponse.ok) throw new Error('템플릿 파일을 불러올 수 없습니다.');
      const templateBuffer = await templateResponse.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(templateBuffer);
      // Excel이 파일을 열 때 모든 수식을 강제 재계산하도록 설정
      // ExcelJS는 수식을 재계산하지 않으므로 이 설정이 필수
      workbook.calcProperties = { fullCalcOnLoad: true };

      // --- 메인 시트 ---
      const mainSheet = workbook.worksheets[0];
      if (!mainSheet) throw new Error('현 재고 시트를 찾을 수 없습니다.');

      // Row 5 서식 참조 저장
      const refStyles: Record<number, Partial<ExcelJS.Style>> = {};
      for (let c = 1; c <= 11; c++) {
        const cell = mainSheet.getCell(5, c);
        refStyles[c] = {};
        if (cell.font) refStyles[c].font = { ...cell.font };
        if (cell.border) refStyles[c].border = JSON.parse(JSON.stringify(cell.border));
        if (cell.alignment) refStyles[c].alignment = { ...cell.alignment };
        if (cell.numFmt) refStyles[c].numFmt = cell.numFmt;
      }

      // --- 카테고리별 아이템 그룹 ---
      const itemsByCategory = new Map<string, InventoryItem[]>();
      sortedExportItems.forEach(item => {
        const cat = normalizeCategory(item.category);
        const list = itemsByCategory.get(cat) ?? [];
        list.push(item);
        itemsByCategory.set(cat, list);
      });

      // masterData 순서 기반 카테고리 목록
      const orderedCategories: string[] = [];
      masterData.categories.forEach(cat => {
        if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
      });
      itemsByCategory.forEach((_, cat) => {
        if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
      });

      // --- 카테고리 시트 동적 생성 (1개 blueprint 복제 방식) ---
      // 첫 번째 카테고리 시트를 blueprint으로 사용
      const blueprintSheet = workbook.worksheets[1];
      if (!blueprintSheet) throw new Error('템플릿에 카테고리 시트가 없습니다.');

      // blueprint의 셀 구조/수식/스타일을 캐시 (한 번만 읽기)
      const MAX_BP_COL = 122; // 30 slots × 4 cols (col 2..121) + margin
      const bpColWidths: Record<number, number> = {};
      for (let c = 1; c <= MAX_BP_COL; c++) {
        const col = blueprintSheet.getColumn(c);
        if (col.width) bpColWidths[c] = col.width;
      }
      const bpRowData: { height?: number, cells: { col: number, formula?: string, value?: any, style?: Partial<ExcelJS.Style> }[] }[] = [];
      for (let r = 1; r <= 390; r++) {
        const row = blueprintSheet.getRow(r);
        const cells: { col: number, formula?: string, value?: any, style?: Partial<ExcelJS.Style> }[] = [];
        for (let c = 1; c <= MAX_BP_COL; c++) {
          const cell = blueprintSheet.getCell(r, c);
          const hasFormula = !!cell.formula;
          const hasValue = cell.value !== null && cell.value !== undefined;
          const hasStyle = cell.style && Object.keys(cell.style).length > 0;
          if (hasFormula || hasValue || hasStyle) {
            cells.push({
              col: c,
              formula: cell.formula || undefined,
              value: (!cell.formula && hasValue) ? cell.value : undefined,
              style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : undefined,
            });
          }
        }
        bpRowData.push({ height: row.height || undefined, cells });
      }
      const bpMerges = [...(blueprintSheet.model.merges || [])];

      // 기존 템플릿 카테고리 시트 모두 삭제
      const sheetsToRemove = workbook.worksheets.slice(1).map(s => s.id);
      sheetsToRemove.forEach(id => workbook.removeWorksheet(id));

      // masterData 순서대로 카테고리 시트 생성
      const categorySheetMap = new Map<string, ExcelJS.Worksheet>();
      orderedCategories.forEach(cat => {
        const sheet = workbook.addWorksheet(cat);

        // 열 너비 복사
        Object.entries(bpColWidths).forEach(([c, w]) => {
          sheet.getColumn(Number(c)).width = w;
        });

        // 행 높이 + 셀 수식/스타일 복사 (blueprint 20슬롯 전체)
        bpRowData.forEach((rowInfo, idx) => {
          const r = idx + 1;
          const row = sheet.getRow(r);
          if (rowInfo.height) row.height = rowInfo.height;
          rowInfo.cells.forEach(cellInfo => {
            const cell = sheet.getCell(r, cellInfo.col);
            if (cellInfo.formula) cell.value = { formula: cellInfo.formula } as any;
            else if (cellInfo.value !== undefined) cell.value = cellInfo.value;
            if (cellInfo.style) cell.style = cellInfo.style;
          });
        });

        // 병합 복사
        bpMerges.forEach(merge => {
          try { sheet.mergeCells(merge); } catch (_) { /* 이미 병합된 경우 무시 */ }
        });

        // Row 2: 대분류명 설정
        sheet.getCell(2, 1).value = cat;

        // 슬롯 초기화: 번호 + 품목명 빈칸 + 기존재고 0
        SLOT_COLS.forEach((col, i) => {
          sheet.getCell(2, col).value = i + 1;  // 슬롯 번호
          sheet.getCell(3, col).value = '';
          sheet.getCell(4, col + 2).value = 0;
        });

        categorySheetMap.set(cat, sheet);
      });

      const filledSlots = new Map<string, { col: number, item: InventoryItem }[]>();
      const unassignedItems: InventoryItem[] = [];

      orderedCategories.forEach(cat => {
        const sheet = categorySheetMap.get(cat);
        const catItems = itemsByCategory.get(cat) || [];
        const slots: { col: number, item: InventoryItem }[] = [];

        catItems.forEach((item, i) => {
          if (i >= SLOT_COLS.length || !sheet) {
            unassignedItems.push(item);
            return;
          }
          const col = SLOT_COLS[i];
          sheet.getCell(3, col).value = item.name;
          // Row 4 carryover: 직접 값으로 설정 (수식 제거)
          const carryOver = Number(carryOverByItemId.get(item.id) ?? 0);
          sheet.getCell(4, col + 2).value = carryOver;
          slots.push({ col, item });
        });

        filledSlots.set(cat, slots);
      });

      // --- 카테고리 시트에 DB 트랜잭션(수불) 데이터 기록 ---
      // 날짜(YYYY-MM-DD) → Row 매핑: Row = 6 + (month-1)*32 + (day-1)
      const dateToRow = (dateStr: string): number | null => {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return 6 + (month - 1) * 32 + (day - 1);
      };

      // itemId → { category, slotCol } 매핑 빌드
      const itemSlotMap = new Map<string, { cat: string, col: number }>();
      filledSlots.forEach((slots, cat) => {
        slots.forEach(slot => {
          itemSlotMap.set(slot.item.id, { cat, col: slot.col });
        });
      });

      // 재고이월 제외 트랜잭션을 카테고리 시트에 기록
      transactions
        .filter(tx => tx.reason !== '재고이월')
        .forEach(tx => {
          const slotInfo = itemSlotMap.get(tx.itemId);
          if (!slotInfo) return;
          const sheet = categorySheetMap.get(slotInfo.cat);
          if (!sheet) return;
          const row = dateToRow(tx.date);
          if (!row || row < 6 || row > 388) return;

          // IN → 입고(col), OUT → 출고(col+1)
          const targetCol = tx.type === 'IN' ? slotInfo.col : slotInfo.col + 1;
          const qty = Number(tx.quantity) || 0;
          // 같은 셀에 여러 트랜잭션이 있으면 합산
          const existing = Number(sheet.getCell(row, targetCol).value) || 0;
          sheet.getCell(row, targetCol).value = existing + qty;
        });

      // --- 현 재고 메인 시트 재구성 ---
      // 기존 데이터 행 병합 해제
      const existingMerges = [...(mainSheet.model.merges || [])];
      existingMerges.forEach(mergeRange => {
        try {
          const match = mergeRange.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
          if (match && Number(match[2]) >= 5) {
            mainSheet.unMergeCells(mergeRange);
          }
        } catch { /* skip */ }
      });

      // 기존 데이터 행 클리어
      for (let r = 5; r <= mainSheet.rowCount; r++) {
        for (let c = 1; c <= 11; c++) {
          mainSheet.getCell(r, c).value = null;
        }
      }

      // --- 레거시 파싱 호환 헤더 행 작성 (Row 4) ---
      // 엑셀 내보내기 파일을 일괄등록/수불부에 재사용할 때 파서가 인식하는 키워드 헤더
      const EXPORT_HEADER_ROW = 4;
      const exportHeaders: { col: number; value: string }[] = [
        { col: 2, value: '연번' },
        { col: 3, value: '대분류' },
        { col: 4, value: '소분류' },
        { col: 5, value: '포장단위' },
        { col: 6, value: '소포장 개수' },
        { col: 7, value: '박스구성' },
        { col: 8, value: '잔량' },
        { col: 9, value: '관리단위' },
      ];
      exportHeaders.forEach(({ col, value }) => {
        const cell = mainSheet.getCell(EXPORT_HEADER_ROW, col);
        cell.value = value;
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (refStyles[col]?.border) cell.border = refStyles[col].border;
      });

      // masterData 순서로 새 데이터 행 작성
      let currentRow = 5;
      let globalNum = 1;

      orderedCategories.forEach(cat => {
        const slots = filledSlots.get(cat) || [];
        // 품목명이 있는 슬롯만 메인 시트에 표시
        const dataSlots = slots.filter(s => s.item.name?.trim());
        if (dataSlots.length === 0) return;

        const startRow = currentRow;
        const sheet = categorySheetMap.get(cat);

        dataSlots.forEach((slot) => {
          const item = slot.item;

          // B: 연번
          mainSheet.getCell(currentRow, 2).value = globalNum;

          // D: 소분류 - 기존 수식 복원 (파싱을 위해 제거했던 부분 원복, 파서를 위해 result값 추가)
          const refColStr = colToLetter(slot.col);
          mainSheet.getCell(currentRow, 4).value = { formula: `'${cat}'!${refColStr}3`, result: item.name || '' };

          // E: 포장단위
          const pkgUnitNum = item.pkgUnit !== undefined && item.pkgUnit !== null && String(item.pkgUnit).trim() !== ''
            ? Number(item.pkgUnit) : NaN;
          mainSheet.getCell(currentRow, 5).value = Number.isNaN(pkgUnitNum) ? '' : pkgUnitNum;

          // F: 박스(묶음)구성
          mainSheet.getCell(currentRow, 6).value = item.pkgType ?? '';

          // G: 소포장 개수
          mainSheet.getCell(currentRow, 7).value = item.outerPkg ?? '';

          // H: 잔량 - 수불부 시트의 연계 값(Row 390)을 참조하는 수식으로 변경, 파서를 위해 result값 추가
          const refColBalanceStr = colToLetter(slot.col + 2);
          const currentStockNum = roundToOneDecimal(item.currentStock, 0);
          mainSheet.getCell(currentRow, 8).value = { formula: `'${cat}'!${refColBalanceStr}390`, result: currentStockNum };

          // I: 관리단위
          mainSheet.getCell(currentRow, 9).value = item.unit ?? '';

          // 서식 적용
          for (let c = 1; c <= 11; c++) {
            const cell = mainSheet.getCell(currentRow, c);
            const style = refStyles[c];
            if (style) {
              if (style.font) cell.font = style.font;
              if (style.border) cell.border = style.border;
              if (style.alignment && c !== 3) cell.alignment = style.alignment;
              if (style.numFmt) cell.numFmt = style.numFmt;
            }
          }

          currentRow++;
          globalNum++;
        });

        // C: 대분류명 병합 (string 기반 안정적 병합) 및 수식 적용
        const endRow = startRow + dataSlots.length - 1;
        if (dataSlots.length > 1) {
          const mergeRef = `C${startRow}:C${endRow}`;
          mainSheet.mergeCells(mergeRef);
        }
        const catCell = mainSheet.getCell(startRow, 3);
        catCell.value = { formula: `'${cat}'!A2`, result: cat || '' }; // 기존 수식 복원 및 파서를 위해 result 추가
        catCell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        if (refStyles[3]?.font) catCell.font = refStyles[3].font;
        if (refStyles[3]?.border) catCell.border = refStyles[3].border;
      });

      // --- 데이터 이후 빈 행 서식 완전 제거 ---
      const totalDataRows = currentRow - 5;
      const templateEndRow = mainSheet.rowCount || 1;
      for (let r = currentRow; r <= templateEndRow; r++) {
        for (let c = 1; c <= 11; c++) {
          const cell = mainSheet.getCell(r, c);
          cell.value = null;
          cell.style = {};
        }
      }


      // --- 엑셀 파일 저장 ---
      const exportName = `Asan-Inventory-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      const exportBuffer = await workbook.xlsx.writeBuffer();
      const exportBlob = new Blob([exportBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(exportBlob, exportName);

      setExportResult({
        show: true,
        isError: false,
        message: unassignedItems.length > 0
          ? `엑셀 파일이 생성되었습니다. 카테고리당 최대 30개 제한으로 초과 품목 ${unassignedItems.length}개는 미배치되었습니다. 대분류를 추가하여 관리하세요.`
          : '엑셀 파일이 성공적으로 생성되었습니다.'
      });

    } catch (error) {
      console.error('Excel export failed:', error);
      setExportResult({
        show: true,
        isError: true,
        message: '엑셀 내보내기 실패: ' + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetLayoutRequest = () => {
    setShowLayoutReset(true);
  };

  const handleResetLayoutConfirm = () => {
    setColWidths(DEFAULT_WIDTHS);
    setShowLayoutReset(false);
    ActionLogger.log('Layout Reset');
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
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row justify-between items-center gap-3 transition-colors shrink-0 bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-2 w-full xl:w-auto z-20">
            {/* Multi-Select Category Dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors shadow-sm ${selectedCategories.length > 0
                  ? 'bg-white border-blue-500 text-blue-700 dark:bg-slate-800 dark:border-blue-500 dark:text-blue-400 ring-1 ring-blue-500'
                  : 'bg-white border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
              >
                <Filter size={14} />
                <span className="truncate max-w-[100px]">
                  {selectedCategories.length === 0
                    ? '전체 분류'
                    : selectedCategories.length === uniqueCategories.length
                      ? '전체 선택됨'
                      : `${selectedCategories.length}개 선택됨`}
                </span>
                <ChevronDown size={14} className="opacity-50" />
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                  <button
                    onClick={toggleAllCategories}
                    className="flex items-center gap-2 w-full px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-sm font-bold text-slate-800 dark:text-slate-200"
                  >
                    {selectedCategories.length === uniqueCategories.length ? (
                      <CheckSquare size={16} className="text-blue-600" />
                    ) : (
                      <Square size={16} className="text-slate-400" />
                    )}
                    전체 선택
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                  {uniqueCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-sm text-left text-slate-700 dark:text-slate-300"
                    >
                      {selectedCategories.includes(cat) ? (
                        <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <span className="truncate">{cat}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear Filter Button */}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg"
                title="필터 초기화"
                aria-label="필터 초기화"
              >
                <XCircle size={18} />
              </button>
            )}

            {/* Low Stock Toggle Filter Button */}
            <button
              onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-black transition-all shadow-sm whitespace-nowrap ${showOnlyLowStock
                ? 'bg-red-50 text-red-700 border-red-500 dark:bg-red-950/60 dark:text-red-400 dark:border-red-500 ring-2 ring-red-500'
                : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
            >
              <AlertCircle size={15} className={showOnlyLowStock ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-400'} />
              <span>{showOnlyLowStock ? `부족재고 필터링 중 (${filteredItems.length}건)` : `부족재고만 보기 (${lowStockCount}건)`}</span>
              {showOnlyLowStock && <X size={14} className="ml-1 opacity-70 hover:opacity-100" />}
            </button>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={`품목명, ${getLabel('supplier', '사용부서')} 검색...`}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-colors shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto justify-end overflow-x-auto">
            <button onClick={onOpenReport} className="px-3 py-2 text-teal-600 border border-teal-200 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/20 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap">
              <BarChart2 size={16} /> 분석 리포트
            </button>
            <button onClick={onOpenMonthlyReport} className="px-3 py-2 text-purple-600 border border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/20 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap">
              <Calendar size={16} /> 월별 수불부
            </button>
            <button onClick={onOpenDBManager} className="px-3 py-2 text-slate-600 border border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap">
              <History size={16} /> 백업/롤백
            </button>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

            <button onClick={handleExportExcel} className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors border border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap">
              <FileDown size={16} /> 엑셀 내보내기
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors border border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap"
            >
              <Printer size={16} /> 재고현황보고서
            </button>
            <button
              onClick={onOpenMonthlyUsageReport}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors border border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap"
            >
              <Printer size={16} /> 사용현황보고서
            </button>

            <button onClick={handleResetLayoutRequest} className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-800" title="레이아웃 초기화" aria-label="레이아웃 초기화">
              <LayoutTemplate size={16} />
            </button>

            {user.role === 'admin' && (
              <button onClick={handleResetClick} className="px-3 py-2 text-red-600 border border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm bg-white dark:bg-slate-800 whitespace-nowrap">
                <RotateCcw size={16} /> DB 초기화
              </button>
            )}

            <button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-black shadow-md transition-colors whitespace-nowrap">
              <Plus size={16} /> 신규 등록
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-900">
          <table className="w-full text-sm text-left table-fixed border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr>
                <ResizableTh width={colWidths.edit} onResizeStart={(e) => handleMouseDown(e, 'edit')} className="text-center"></ResizableTh>
                <ResizableTh width={colWidths.no} onResizeStart={(e) => handleMouseDown(e, 'no')}>No</ResizableTh>
                <ResizableTh width={colWidths.category} onResizeStart={(e) => handleMouseDown(e, 'category')} align="left">{getLabel('category', '대분류')}</ResizableTh>
                <ResizableTh width={colWidths.name} onResizeStart={(e) => handleMouseDown(e, 'name')} align="left">{getLabel('name', '소분류')}</ResizableTh>
                <ResizableTh width={colWidths.pkgUnit} onResizeStart={(e) => handleMouseDown(e, 'pkgUnit')}>{getLabel('pkgUnit', '포장단위')}</ResizableTh>
                <ResizableTh width={colWidths.pkgType} onResizeStart={(e) => handleMouseDown(e, 'pkgType')}>{getLabel('pkgType', '소포장 개수')}</ResizableTh>
                <ResizableTh width={colWidths.outerPkg} onResizeStart={(e) => handleMouseDown(e, 'outerPkg')}>{getLabel('outerPkg', '박스구성')}</ResizableTh>
                <ResizableTh width={colWidths.currentStock} onResizeStart={(e) => handleMouseDown(e, 'currentStock')} align="right">{getLabel('currentStock', '잔량')}</ResizableTh>
                <ResizableTh width={colWidths.unit} onResizeStart={(e) => handleMouseDown(e, 'unit')}>{getLabel('unit', '관리단위')}</ResizableTh>
                <ResizableTh width={colWidths.location} onResizeStart={(e) => handleMouseDown(e, 'location')}>{getLabel('location', '보관장소')}</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item, index) => {
                const stats = item3MonthStats.get(item.id) || item3MonthStats.get(item.name);
                const monthlyAvgOut = stats ? stats.monthlyAvg : 0;
                const calculatedSafe = monthlyAvgOut > 0 ? Math.ceil(monthlyAvgOut) : Number(item.safeStock ?? 1);
                const isLowStock = item.currentStock < calculatedSafe;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50 dark:hover:bg-blue-900/10 group cursor-pointer transition-colors"
                    onClick={() => onTransaction(item)}
                  >
                    <td className="px-2 py-3 text-center border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEdit(item.id)}
                        className="p-1.5 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors shadow-sm"
                        title="품목 수정"
                        aria-label="품목 수정"
                      >
                        <Edit size={14} strokeWidth={2.5} />
                      </button>
                    </td>
                    <td className="px-2 py-3 text-center text-slate-400 font-mono text-sm border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800 font-bold">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-extrabold text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {item.category}
                    </td>
                    <td className="px-3 py-3 font-black text-slate-900 dark:text-white text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {item.name}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {formatOneDecimal(item.pkgUnit)}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {item.pkgType}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {formatOneDecimal(item.outerPkg)}
                    </td>
                    <td className="px-3 py-3 text-right border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      <div className={`flex items-center justify-end gap-1.5 ${isLowStock ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-900 dark:text-white font-black'}`}>
                        <span className="text-base">{formatOneDecimal(item.currentStock)}</span>
                        {isLowStock && <AlertCircle size={15} className="text-red-500 animate-pulse" />}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-sm border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {item.unit}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-sm truncate border-r border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-800">
                      {item.location}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center">
              <Box size={48} className="mb-4 text-slate-300 dark:text-slate-700" strokeWidth={1} />
              <p className="text-lg font-medium">검색 결과가 없습니다.</p>
              <p className="text-sm mt-1">다른 검색어를 입력하거나 필터를 초기화해보세요.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-slate-600 dark:text-slate-400">
              <strong className="text-red-600 dark:text-red-400">붉은색 숫자</strong>는 적정재고 미달 품목입니다. (아이콘 클릭: 수정, 행 클릭: 입출고)
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="pl-4 border-l border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
              총 {items.length}개 품목
            </div>
          </div>
        </div>
      </div>

      {showReport && (
        <ReportModal items={filteredItems} masterData={masterData} onClose={() => setShowReport(false)} columnWidths={colWidths} />
      )}
      {showLayoutReset && (
        <ConfirmationModal
          title="레이아웃 초기화"
          message="테이블 컬럼 너비를 기본값으로 되돌리시겠습니까?"
          onConfirm={handleResetLayoutConfirm}
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
      {/* Loading Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col gap-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <div className="animate-spin text-blue-600 dark:text-blue-400">
              <Loader2 size={48} />
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">엑셀 파일 생성 중...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">잠시만 기다려주세요.</p>
          </div>
        </div>
      )}

      {/* Export Result Modal */}
      {exportResult.show && (
        <ConfirmationModal
          title={exportResult.isError ? "내보내기 실패" : "내보내기 성공"}
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
