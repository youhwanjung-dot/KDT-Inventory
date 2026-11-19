import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { InventoryItem, InventoryTransaction, MasterData } from '../../types';
import { formatItemDisplayKey, roundToInt } from '../../utils/formatters';

export interface ExportExcelParams {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  selectedCategories: string[];
  categoryOrderMap: Map<string, number>;
  namesByCategoryOrderMap: Map<string, Map<string, number>>;
  targetYear?: number;
}

export interface ExportExcelResult {
  unassignedCount: number;
  fileName: string;
  targetYear: number;
}

// KDT: 40 slots per ZONE sheet (cols: 2, 6, 10 ... 158 -> total 160 slot cols)
// Matches the fixed 40-row Main sheet block, including empty slots
const MAX_SLOTS = 40;
const SLOT1_START_COL = 2;
const SLOT_WIDTH = 4;
const MAX_ROW = 390;
const SLOT_COLS = Array.from({ length: MAX_SLOTS }, (_, i) => SLOT1_START_COL + i * SLOT_WIDTH);

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

const letterToCol = (str: string): number =>
  str.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);

const shiftFormula = (formula: string, colOffset: number): string => {
  if (colOffset === 0) return formula;
  return formula.replace(/\b([A-Z]{1,3})(\d+)\b/g, (_, col, row) => {
    const cn = letterToCol(col);
    if (cn < SLOT1_START_COL) return `${col}${row}`;
    return `${colToLetter(cn + colOffset)}${row}`;
  });
};

const shiftMerge = (mergeRef: string, colOffset: number): string => {
  if (colOffset === 0) return mergeRef;
  return mergeRef.replace(/([A-Z]{1,3})(\d+)/g, (_, col, row) => {
    const cn = letterToCol(col);
    return `${colToLetter(cn + colOffset)}${row}`;
  });
};

const dateToRow = (dateStr: string, targetYear: number): number | null => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year !== targetYear || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return 6 + (month - 1) * 32 + (day - 1);
};

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
};

/**
 * Exports KDT inventory and daily transactions into the bidirectional Excel workbook:
 * - "Main" summary sheet + per-ZONE 40-slot daily ledger sheets
 * - Automatically regenerates the 1-year daily calendar in Column A for `targetYear` (e.g. 2026 -> 2027)
 * - Automatically rolls over prior-year net balance into Row 4 (기초 이월재고) when exporting a new year
 */
export async function exportInventoryToExcel({
  items,
  transactions,
  masterData,
  selectedCategories,
  categoryOrderMap,
  namesByCategoryOrderMap,
  targetYear = new Date().getFullYear(),
}: ExportExcelParams): Promise<ExportExcelResult> {
  const normalizeCategory = (v: string) => (v || '').trim();
  const normalizeText = (v: string) => (v || '').replace(/\s+/g, ' ').trim();
  const yearStartStr = `${targetYear}-01-01`;

  // 1. Calculate carry-over stock per item for `targetYear`:
  //    - If explicit '재고이월' transaction exists in targetYear, use it.
  //    - Otherwise, automatically compute cumulative net stock prior to `targetYear-01-01`
  //      (or reverse-calculate from currentStock - net transactions from targetYear onwards).
  const carryOverByItemId = new Map<string, number>();
  items.forEach((item) => {
    const itemTxs = transactions.filter((t) => t.itemId === item.id);
    const explicitCarry = itemTxs.filter(
      (t) => t.reason === '재고이월' && String(t.date || '').startsWith(`${targetYear}-`)
    );
    if (explicitCarry.length > 0) {
      const sumCarry = explicitCarry.reduce((acc, t) => acc + roundToInt(t.quantity, 0), 0);
      carryOverByItemId.set(item.id, sumCarry);
    } else {
      // Back-calculate start-of-year stock from currentStock minus all non-carry transactions on/after targetYear-01-01
      const onOrAfterTxs = itemTxs.filter(
        (t) => t.reason !== '재고이월' && String(t.date || '') >= yearStartStr
      );
      let startOfYearStock = roundToInt(item.currentStock, 0);
      onOrAfterTxs.forEach((t) => {
        const q = roundToInt(t.quantity, 0);
        if (t.type === 'IN') startOfYearStock -= q;
        else startOfYearStock += q;
      });
      carryOverByItemId.set(item.id, Math.max(0, startOfYearStock));
    }
  });

  // 2. Filter and sort items by ZONE -> item order
  const exportItems =
    selectedCategories.length > 0
      ? items.filter((item) => selectedCategories.includes(item.category))
      : items;

  const sortedExportItems = [...exportItems].sort((a, b) => {
    const catA = categoryOrderMap.get(a.category);
    const catB = categoryOrderMap.get(b.category);
    if (catA !== undefined && catB !== undefined && catA !== catB) return catA - catB;
    if (catA !== undefined && catB === undefined) return -1;
    if (catA === undefined && catB !== undefined) return 1;
    const catCmp = (a.category || '').localeCompare(b.category || '');
    if (catCmp !== 0) return catCmp;

    const catNameMap = namesByCategoryOrderMap.get(a.category);
    if (catNameMap) {
      const keyA = formatItemDisplayKey(a);
      const keyB = formatItemDisplayKey(b);
      const ordA = catNameMap.get(keyA) ?? catNameMap.get(a.name);
      const ordB = catNameMap.get(keyB) ?? catNameMap.get(b.name);
      if (ordA !== undefined && ordB !== undefined && ordA !== ordB) return ordA - ordB;
      if (ordA !== undefined) return -1;
      if (ordB !== undefined) return 1;
    }
    return normalizeText(formatItemDisplayKey(a)).localeCompare(normalizeText(formatItemDisplayKey(b)));
  });

  // 3. Load template workbook (cache-busted)
  const templateResponse = await fetch(`${import.meta.env.BASE_URL}template.xlsx?v=${Date.now()}`);
  if (!templateResponse.ok) throw new Error('템플릿 파일(template.xlsx)을 불러올 수 없습니다.');
  const templateBuffer = await templateResponse.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  workbook.calcProperties = { fullCalcOnLoad: true };

  const mainSheet = workbook.worksheets[0];
  if (!mainSheet) throw new Error('현 재고 시트를 찾을 수 없습니다.');

  const refStyles: Record<number, Partial<ExcelJS.Style>> = {};
  for (let c = 1; c <= 12; c++) {
    const cell = mainSheet.getCell(2, c);
    refStyles[c] = {};
    if (cell.font) refStyles[c].font = { ...cell.font };
    if (cell.border) refStyles[c].border = JSON.parse(JSON.stringify(cell.border));
    if (cell.alignment) refStyles[c].alignment = { ...cell.alignment };
    if (cell.numFmt) refStyles[c].numFmt = cell.numFmt;
  }

  // Group items by ZONE
  const itemsByCategory = new Map<string, InventoryItem[]>();
  sortedExportItems.forEach((item) => {
    const cat = normalizeCategory(item.category);
    const list = itemsByCategory.get(cat) ?? [];
    list.push(item);
    itemsByCategory.set(cat, list);
  });

  const orderedCategories: string[] = [];
  const isCategorySelected = (cat: string) =>
    selectedCategories.length === 0 || selectedCategories.includes(cat);
  masterData.categories.forEach((cat) => {
    if (isCategorySelected(cat) && !orderedCategories.includes(cat)) orderedCategories.push(cat);
  });
  itemsByCategory.forEach((_, cat) => {
    if (isCategorySelected(cat) && !orderedCategories.includes(cat)) orderedCategories.push(cat);
  });

  // Keep the summary sheet distinct from every exported ZONE name.
  const exportedSheetNames = new Set(orderedCategories.map((cat) => cat.toLocaleLowerCase()));
  let summarySheetName = '현 재고';
  let summarySuffix = 1;
  while (exportedSheetNames.has(summarySheetName.toLocaleLowerCase())) {
    summarySheetName = `현 재고 (${summarySuffix++})`;
  }
  mainSheet.name = summarySheetName;

  // 4. Extract Column A (date column) + Slot 1 (cols 2..5) pattern from blueprint sheet
  //    so we can dynamically generate up to MAX_SLOTS (40) slots per ZONE sheet!
  const blueprintSheet = workbook.worksheets[1];
  if (!blueprintSheet) throw new Error('템플릿에 ZONE 수불부 시트가 없습니다.');

  const colAWidth = blueprintSheet.getColumn(1).width || 13;
  const slot1ColWidths: number[] = [];
  for (let rel = 0; rel < SLOT_WIDTH; rel++) {
    slot1ColWidths.push(blueprintSheet.getColumn(SLOT1_START_COL + rel).width || 9);
  }

  const slotNumStyle = blueprintSheet.getCell(2, SLOT1_START_COL).style
    ? JSON.parse(JSON.stringify(blueprintSheet.getCell(2, SLOT1_START_COL).style))
    : undefined;

  const colAPattern: {
    height?: number;
    value?: any;
    style?: Partial<ExcelJS.Style>;
  }[] = [];

  const slot1Pattern: {
    relCol: number;
    formula?: string;
    value?: any;
    style?: Partial<ExcelJS.Style>;
  }[][] = [];

  for (let r = 1; r <= MAX_ROW; r++) {
    const bpRow = blueprintSheet.getRow(r);
    const cellA = blueprintSheet.getCell(r, 1);
    colAPattern.push({
      height: bpRow.height || undefined,
      value: cellA.value,
      style: cellA.style ? JSON.parse(JSON.stringify(cellA.style)) : undefined,
    });

    const rowSlotCells: {
      relCol: number;
      formula?: string;
      value?: any;
      style?: Partial<ExcelJS.Style>;
    }[] = [];
    for (let rel = 0; rel < SLOT_WIDTH; rel++) {
      if (r === 2 && rel === 0) continue; // Slot number handled separately
      const c = SLOT1_START_COL + rel;
      const cell = blueprintSheet.getCell(r, c);
      const hasFormula = !!cell.formula;
      // The template's first slot can contain sample transactions; copy only its
      // static header values, never dated IN/OUT quantities into every new slot.
      const hasValue = r <= 5 && cell.value !== null && cell.value !== undefined && !hasFormula;
      const hasStyle = cell.style && Object.keys(cell.style).length > 0;
      if (hasFormula || hasValue || hasStyle) {
        rowSlotCells.push({
          relCol: rel,
          formula: cell.formula || undefined,
          value: hasValue ? cell.value : undefined,
          style: hasStyle ? JSON.parse(JSON.stringify(cell.style)) : undefined,
        });
      }
    }
    slot1Pattern.push(rowSlotCells);
  }

  const slot1Merges = (blueprintSheet.model.merges || []).filter((merge) => {
    const m = merge.match(/^([A-Z]{1,3})\d+/);
    if (!m) return false;
    const sc = letterToCol(m[1]);
    return sc >= SLOT1_START_COL && sc < SLOT1_START_COL + SLOT_WIDTH;
  });

  // Remove old template category sheets
  workbook.worksheets
    .slice(1)
    .map((s) => s.id)
    .forEach((id) => workbook.removeWorksheet(id));

  // 5. Build ZONE sheets with 40 slots and dynamic `targetYear` 1-year calendar
  const categorySheetMap = new Map<string, ExcelJS.Worksheet>();
  orderedCategories.forEach((cat) => {
    const sheet = workbook.addWorksheet(cat);
    sheet.pageSetup = {
      ...blueprintSheet.pageSetup,
      fitToPage: false,
      scale: 40,
      printArea: `A1:${colToLetter(SLOT_COLS[MAX_SLOTS - 1] + SLOT_WIDTH - 1)}${MAX_ROW}`,
    };
    sheet.getColumn(1).width = Math.max(colAWidth, 13);

    // Populate Column A + Row heights
    for (let r = 1; r <= MAX_ROW; r++) {
      const aInfo = colAPattern[r - 1];
      const row = sheet.getRow(r);
      if (aInfo.height) row.height = aInfo.height;
      const cellA = sheet.getCell(r, 1);
      if (aInfo.style) cellA.style = aInfo.style;
      if (aInfo.value !== undefined) cellA.value = aInfo.value;
    }

    // Overwrite Column A calendar with `targetYear` dates (12 months × 32 rows)
    sheet.getCell(1, 1).value = `${targetYear}년 ${cat} 수불부`;
    sheet.getCell(2, 1).value = cat;

    for (let month = 1; month <= 12; month++) {
      const mm = String(month).padStart(2, '0');
      for (let day = 1; day <= 31; day++) {
        const r = 6 + (month - 1) * 32 + (day - 1);
        const cellA = sheet.getCell(r, 1);
        if (isValidCalendarDate(targetYear, month, day)) {
          const dd = String(day).padStart(2, '0');
          cellA.value = `${targetYear}-${mm}-${dd}`;
          cellA.numFmt = 'yyyy-mm-dd';
        } else {
          // Non-existent calendar day (e.g. Feb 29 in non-leap year, Feb 30/31, Apr 31)
          cellA.value = '-';
        }
      }
      // Monthly subtotal row label (32nd row of each month block)
      const monthTotalRow = 6 + (month - 1) * 32 + 31;
      sheet.getCell(monthTotalRow, 1).value = `${month}월 계`;
    }
    sheet.getCell(390, 1).value = '연 계';

    // Replicate MAX_SLOTS (40) slots across columns
    for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
      const targetStartCol = SLOT_COLS[slotIdx];
      const colOffset = targetStartCol - SLOT1_START_COL;
      const slotNum = slotIdx + 1;

      for (let rel = 0; rel < SLOT_WIDTH; rel++) {
        sheet.getColumn(targetStartCol + rel).width = slot1ColWidths[rel];
      }

      for (let r = 1; r <= MAX_ROW; r++) {
        const rowCells = slot1Pattern[r - 1];
        for (const ci of rowCells) {
          const targetCol = targetStartCol + ci.relCol;
          const cell = sheet.getCell(r, targetCol);
          if (ci.formula) {
            cell.value = { formula: shiftFormula(ci.formula, colOffset) } as any;
          } else if (ci.value !== undefined) {
            cell.value = ci.value;
          }
          if (ci.style) cell.style = ci.style;
        }
      }

      // Row 2: Slot number
      const slotNumCell = sheet.getCell(2, targetStartCol);
      if (slotIdx === 0) {
        slotNumCell.value = 1;
      } else {
        const prevColLetter = colToLetter(SLOT_COLS[slotIdx - 1]);
        slotNumCell.value = { formula: `${prevColLetter}2+1`, result: slotNum } as any;
      }
      if (slotNumStyle) slotNumCell.style = slotNumStyle;

      // Clear Row 3 item title & set Row 4 initial carry-over to 0
      sheet.getCell(3, targetStartCol).value = '';
      sheet.getCell(4, targetStartCol + 2).value = 0;
      sheet.getCell(4, targetStartCol + 2).numFmt = '#,##0';

      // Merges per slot
      for (const merge of slot1Merges) {
        try {
          sheet.mergeCells(shiftMerge(merge, colOffset));
        } catch {}
      }
    }

    categorySheetMap.set(cat, sheet);
  });

  // 6. Assign items into MAX_SLOTS (40) slots per ZONE sheet
  const filledSlots = new Map<string, { col: number; item: InventoryItem; displayKey: string }[]>();
  const unassignedItems: InventoryItem[] = [];

  orderedCategories.forEach((cat) => {
    const sheet = categorySheetMap.get(cat);
    const catItems = itemsByCategory.get(cat) || [];
    const slots: { col: number; item: InventoryItem; displayKey: string }[] = [];

    catItems.forEach((item, i) => {
      if (i >= SLOT_COLS.length || !sheet) {
        unassignedItems.push(item);
        return;
      }
      const col = SLOT_COLS[i];
      const displayKey = formatItemDisplayKey(item);
      sheet.getCell(3, col).value = displayKey;
      sheet.getCell(4, col + 2).value = roundToInt(carryOverByItemId.get(item.id) ?? 0, 0);
      slots.push({ col, item, displayKey });
    });

    filledSlots.set(cat, slots);
  });

  // 7. Write `targetYear` daily transactions into ZONE sheets
  const itemSlotMap = new Map<string, { cat: string; col: number }>();
  filledSlots.forEach((slots, cat) => {
    slots.forEach((slot) => itemSlotMap.set(slot.item.id, { cat, col: slot.col }));
  });

  transactions
    .filter((tx) => tx.reason !== '재고이월')
    .forEach((tx) => {
      const slotInfo = itemSlotMap.get(tx.itemId);
      if (!slotInfo) return;
      const sheet = categorySheetMap.get(slotInfo.cat);
      if (!sheet) return;
      const row = dateToRow(tx.date, targetYear);
      if (!row || row < 6 || row > 388) return;

      const targetCol = tx.type === 'IN' ? slotInfo.col : slotInfo.col + 1;
      const qty = roundToInt(tx.quantity, 0);
      const existing = roundToInt(sheet.getCell(row, targetCol).value as number, 0);
      sheet.getCell(row, targetCol).value = existing + qty;
    });

  // 8. Rebuild main summary sheet ("현 재고")
  //    - Header at Row 1, data from Row 2
  //    - FIXED 40 rows per category (대분류) including empty slots (KDT spec, not dynamic like Asan)
  //    - Serial number (연번) 1~40 per category
  //    - Linked to ZONE calendar sheets via formulas (품명: row3, 현재고: row390 재고 col)
  //    - Preserve template pageSetup (A4 portrait, fixed 40% scale, printTitlesRow 1:1, margins 0.39)

  [...(mainSheet.model.merges || [])].forEach((mergeRange) => {
    try {
      const match = mergeRange.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (match && Number(match[2]) >= 2) {
        mainSheet.unMergeCells(mergeRange);
      }
    } catch {}
  });

  for (let r = 2; r <= mainSheet.rowCount; r++) {
    for (let c = 1; c <= 12; c++) {
      mainSheet.getCell(r, c).value = null;
    }
  }

  // Preserve template paper, margins, and repeated heading rows; use a fixed print scale.
  if (mainSheet.pageSetup) {
    mainSheet.pageSetup.fitToPage = false;
    mainSheet.pageSetup.scale = 40;
    mainSheet.pageSetup.horizontalCentered = true;
  }

  const EXPORT_HEADER_ROW = 1;
  const exportHeaders: { col: number; value: string; width: number }[] = [
    { col: 2, value: '연번', width: 7 },
    { col: 3, value: 'ZONE(대분류)', width: 16 },
    { col: 4, value: '품명', width: 28 },
    { col: 5, value: '도금', width: 9 },
    { col: 6, value: '규격', width: 13 },
    { col: 7, value: '단위/환산', width: 14 },
    { col: 8, value: '현재고(EA)', width: 14 },
    { col: 9, value: '보관위치', width: 14 },
    { col: 10, value: '1대당소요', width: 10 },
    { col: 11, value: '비고', width: 32 },
  ];
  exportHeaders.forEach(({ col, value, width }) => {
    const cell = mainSheet.getCell(EXPORT_HEADER_ROW, col);
    cell.value = value;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    const headerBorder = refStyles[Math.min(col, 9)]?.border;
    if (headerBorder) cell.border = headerBorder as Partial<ExcelJS.Borders>;
    mainSheet.getColumn(col).width = width;
  });
  mainSheet.getRow(EXPORT_HEADER_ROW).height = 35.1;

  const ROW_HEIGHT = 35.1;
  let currentRow = 2;

  orderedCategories.forEach((cat) => {
    const slots = (filledSlots.get(cat) || []).filter((s) => s.item.name?.trim());

    const startRow = currentRow;
    const endRow = startRow + MAX_SLOTS - 1;

    // Always generate exactly MAX_SLOTS (40) rows per category — including empty slots.
    for (let i = 0; i < MAX_SLOTS; i++) {
      const rowIdx = startRow + i;
      const slot = slots[i];

      mainSheet.getCell(rowIdx, 2).value = i + 1;

      if (slot) {
        const { item, displayKey } = slot;
        const refColStr = colToLetter(slot.col);
        const refColBalanceStr = colToLetter(slot.col + 2);

        mainSheet.getCell(rowIdx, 4).value = { formula: `'${cat}'!${refColStr}3`, result: displayKey };
        mainSheet.getCell(rowIdx, 5).value = item.plating || '';
        mainSheet.getCell(rowIdx, 6).value = item.spec || '';
        const unitInfo =
          (item.eaPerUnit ?? 1) > 1 && item.unit !== 'EA'
            ? `${item.unit}(×${item.eaPerUnit})`
            : item.unit || 'EA';
        mainSheet.getCell(rowIdx, 7).value = unitInfo;
        mainSheet.getCell(rowIdx, 8).value = {
          formula: `'${cat}'!${refColBalanceStr}390`,
          result: roundToInt(item.currentStock, 0),
        };
        mainSheet.getCell(rowIdx, 8).numFmt = '#,##0';
        mainSheet.getCell(rowIdx, 9).value = item.location || '';
        mainSheet.getCell(rowIdx, 10).value = item.qtyPerProduct || '';
        mainSheet.getCell(rowIdx, 11).value = item.note || '';
      }

      // Apply style (border + font + alignment) to ALL 40 rows (including empty slots)
      for (let c = 2; c <= 11; c++) {
        const cell = mainSheet.getCell(rowIdx, c);
        const style = refStyles[Math.min(c, 9)];
        if (style?.font) cell.font = style.font;
        if (style?.border) cell.border = style.border;
        if (slot) {
          if (c === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (c === 4 || c === 11) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (c !== 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        }
      }
      mainSheet.getRow(rowIdx).height = ROW_HEIGHT;
    }

    // Store the exact data-sheet name as plain text for reliable ZONE matching.
    if (MAX_SLOTS > 1) {
      mainSheet.mergeCells(`C${startRow}:C${endRow}`);
    }
    const catCell = mainSheet.getCell(startRow, 3);
    catCell.value = cat;
    catCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    if (refStyles[3]?.font) catCell.font = refStyles[3].font;
    if (refStyles[3]?.border) catCell.border = refStyles[3].border as Partial<ExcelJS.Borders>;

    // Page break after each 40-row category block
    try {
      mainSheet.getRow(endRow).addPageBreak();
    } catch {}

    currentRow = endRow + 1;
  });

  // Set printArea dynamically to cover all generated rows
  const lastDataRow = currentRow - 1;
  if (mainSheet.pageSetup) {
    mainSheet.pageSetup.printArea = `A1:K${lastDataRow}`;
  }

  const templateEndRow = mainSheet.rowCount || 1;
  for (let r = currentRow; r <= templateEndRow; r++) {
    for (let c = 1; c <= 12; c++) {
      const cell = mainSheet.getCell(r, c);
      cell.value = null;
      cell.style = {};
    }
  }

  const fileName = `KDT-Inventory-${targetYear}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  const exportBuffer = await workbook.xlsx.writeBuffer();
  const exportBlob = new Blob([exportBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(exportBlob, fileName);

  return { unassignedCount: unassignedItems.length, fileName, targetYear };
}
