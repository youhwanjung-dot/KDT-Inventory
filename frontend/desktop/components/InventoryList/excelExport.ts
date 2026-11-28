import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { InventoryItem, InventoryTransaction, MasterData, ZoneArchiveData } from '../../types';
import { formatItemDisplayKey, roundToInt } from '../../utils/formatters';
import { sortInventoryItems } from '../../utils/inventorySort';

export interface ExportExcelParams {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  zoneArchives?: ZoneArchiveData[];
  selectedCategories: string[];
  categoryOrderMap: Map<string, number>;
  targetYear?: number;
}

export interface ExportExcelResult {
  unassignedCount: number;
  fileName: string;
  targetYear: number;
}

// Each ZONE ledger sheet and Main summary page holds 40 item slots.
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
  zoneArchives = [],
  selectedCategories,
  categoryOrderMap,
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
      carryOverByItemId.set(item.id, startOfYearStock);
    }
  });

  // 2. Filter and sort items by ZONE -> item order
  const exportItems =
    selectedCategories.length > 0
      ? items.filter((item) => selectedCategories.includes(item.category))
      : items;

  const sortedExportItems = sortInventoryItems(exportItems, categoryOrderMap);

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
  const sourceSheetNames = ['DB_품목원본', 'DB_거래원본', 'DB_기준정보'];
  const exportedSheetNames = new Set([
    ...orderedCategories,
    ...sourceSheetNames,
  ].map((name) => name.toLocaleLowerCase()));
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

  // 5. Build one ZONE ledger sheet per 40-item page.
  const categoryPages = new Map<string, {
    sheetName: string;
    sheet: ExcelJS.Worksheet;
    items: InventoryItem[];
  }[]>();
  const usedSheetNames = new Set<string>([
    summarySheetName.toLocaleLowerCase(),
    ...sourceSheetNames.map((name) => name.toLocaleLowerCase()),
  ]);
  const getUniqueSheetName = (category: string, pageIndex: number) => {
    const suffix = pageIndex === 0 ? '' : `_${pageIndex + 1}`;
    const base = (category || 'ZONE')
      .replaceAll('[', '_')
      .replaceAll(']', '_')
      .replace(/[\\/:*?]/g, '_');
    const truncatedBase = base.slice(0, Math.max(1, 31 - suffix.length));
    let candidate = `${truncatedBase}${suffix}`;
    let duplicateIndex = 2;
    while (usedSheetNames.has(candidate.toLocaleLowerCase())) {
      const duplicateSuffix = `_${duplicateIndex++}`;
      candidate = `${base.slice(0, Math.max(1, 31 - duplicateSuffix.length))}${duplicateSuffix}`;
    }
    usedSheetNames.add(candidate.toLocaleLowerCase());
    return candidate;
  };

  orderedCategories.forEach((cat) => {
    const catItems = itemsByCategory.get(cat) || [];
    const pageCount = Math.max(1, Math.ceil(catItems.length / MAX_SLOTS));
    const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
      const pageItems = catItems.slice(pageIndex * MAX_SLOTS, (pageIndex + 1) * MAX_SLOTS);
      const sheetName = getUniqueSheetName(cat, pageIndex);
      const sheet = workbook.addWorksheet(sheetName);
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
    sheet.getCell(1, 1).value = `${targetYear}년 ${cat} 수불부${pageIndex > 0 ? ` (${pageIndex + 1}페이지)` : ''}`;
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

    // Replicate 40 slots across columns, including empty slots on the final page.
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

      pageItems.forEach((item, slotIndex) => {
        const col = SLOT_COLS[slotIndex];
        const displayKey = formatItemDisplayKey(item);
        sheet.getCell(3, col).value = displayKey;
        sheet.getCell(4, col + 2).value = roundToInt(carryOverByItemId.get(item.id) ?? 0, 0);
        sheet.getCell(4, col + 2).numFmt = '#,##0';
      });

      return { sheetName, sheet, items: pageItems };
    });
    categoryPages.set(cat, pages);
  });

  // 6. Write `targetYear` daily transactions into their ZONE page sheets.
  const itemSlotMap = new Map<string, { sheet: ExcelJS.Worksheet; col: number }>();
  categoryPages.forEach((pages) => {
    pages.forEach(({ sheet, items: pageItems }) => {
      pageItems.forEach((item, slotIndex) => {
        itemSlotMap.set(item.id, { sheet, col: SLOT_COLS[slotIndex] });
      });
    });
  });

  transactions
    .filter((tx) => tx.reason !== '재고이월')
    .forEach((tx) => {
      const slotInfo = itemSlotMap.get(tx.itemId);
      if (!slotInfo) return;
      const row = dateToRow(tx.date, targetYear);
      if (!row || row < 6 || row > 388) return;

      const targetCol = tx.type === 'IN' ? slotInfo.col : slotInfo.col + 1;
      const qty = roundToInt(tx.quantity, 0);
      const existing = roundToInt(slotInfo.sheet.getCell(row, targetCol).value as number, 0);
      slotInfo.sheet.getCell(row, targetCol).value = existing + qty;
    });

  // 8. Rebuild main summary sheet ("현 재고")
  //    - Each category uses as many 40-row blocks as needed, with empty slots on the last block.
  //    - Rows link to the matching ZONE ledger page for names and closing stock.
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
    { col: 8, value: '현재고', width: 14 },
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
    const pages = categoryPages.get(cat) || [];
    pages.forEach(({ sheetName, items: pageItems }, pageIndex) => {
      const startRow = currentRow;
      const endRow = startRow + MAX_SLOTS - 1;

      for (let i = 0; i < MAX_SLOTS; i++) {
      const rowIdx = startRow + i;
      const item = pageItems[i];

      mainSheet.getCell(rowIdx, 2).value = i + 1;

      if (item) {
        const refColStr = colToLetter(SLOT_COLS[i]);
        const refColBalanceStr = colToLetter(SLOT_COLS[i] + 2);
        const quotedSheetName = `'${sheetName.replace(/'/g, "''")}'`;

        mainSheet.getCell(rowIdx, 4).value = { formula: `${quotedSheetName}!${refColStr}3`, result: formatItemDisplayKey(item) };
        mainSheet.getCell(rowIdx, 5).value = item.plating || '';
        mainSheet.getCell(rowIdx, 6).value = item.spec || '';
        const unitInfo =
          (item.eaPerUnit ?? 1) > 1 && item.unit !== 'EA'
            ? `${item.unit}(×${item.eaPerUnit})`
            : item.unit || 'EA';
        mainSheet.getCell(rowIdx, 7).value = unitInfo;
        mainSheet.getCell(rowIdx, 8).value = {
          formula: `${quotedSheetName}!${refColBalanceStr}390`,
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
        if (item) {
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
      mainSheet.mergeCells(`C${startRow}:C${endRow}`);
      const catCell = mainSheet.getCell(startRow, 3);
      catCell.value = pageIndex === 0 ? cat : `${cat} (${pageIndex + 1})`;
      catCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (refStyles[3]?.font) catCell.font = refStyles[3].font;
      if (refStyles[3]?.border) catCell.border = refStyles[3].border as Partial<ExcelJS.Borders>;

      try {
        mainSheet.getRow(endRow).addPageBreak();
      } catch {}

      currentRow = endRow + 1;
    });
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

  const addSourceSheet = (
    name: string,
    title: string,
    headers: string[],
    records: Array<{ visible: (string | number)[]; source: unknown }>
  ) => {
    const serializedRecords = records.map((record) => JSON.stringify(record.source) ?? 'null');
    const jsonChunkCount = Math.max(
      1,
      ...serializedRecords.map((json) => Math.ceil(json.length / 30000))
    );
    const jsonHeaders = Array.from(
      { length: jsonChunkCount },
      (_, index) => jsonChunkCount === 1 ? '원본 JSON' : `원본 JSON ${index + 1}`
    );
    const fullHeaders = [...headers.slice(0, -1), ...jsonHeaders];
    const visibleColumnCount = headers.length - 1;
    const sheet = workbook.addWorksheet(name);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { bold: true, size: 14 };
    sheet.getCell(2, 1).value = '형식';
    sheet.getCell(2, 2).value = 'KDT_DB_BACKUP_V1';
    sheet.getCell(2, 3).value = '레코드 수';
    sheet.getCell(2, 4).value = records.length;
    sheet.getCell(3, 1).value = '내보내기 시각';
    sheet.getCell(3, 2).value = new Date().toISOString();
    fullHeaders.forEach((header, index) => {
      const cell = sheet.getCell(4, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    records.forEach(({ visible }, index) => {
      const row = sheet.getRow(index + 5);
      visible.forEach((value, colIndex) => {
        row.getCell(colIndex + 1).value = value;
      });
      const json = serializedRecords[index];
      for (let chunkIndex = 0; chunkIndex < jsonChunkCount; chunkIndex++) {
        row.getCell(visible.length + chunkIndex + 1).value = json.slice(
          chunkIndex * 30000,
          (chunkIndex + 1) * 30000
        );
      }
      row.height = 30;
    });
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, records.length + 4), column: fullHeaders.length },
    };
    fullHeaders.forEach((header, index) => {
      const width = header === '원본 JSON' ? 55 : Math.min(28, Math.max(12, header.length * 2 + 4));
      sheet.getColumn(index + 1).width = width;
    });
    for (let column = visibleColumnCount; column < fullHeaders.length; column++) {
      sheet.getColumn(column + 1).width = 55;
      sheet.getColumn(column + 1).alignment = { wrapText: true, vertical: 'top' };
    }
  };

  // These visible source tabs preserve exact Firestore records for full restore.
  addSourceSheet(
    'DB_품목원본',
    '품목 원본 데이터 (DB 복구용)',
    ['ID', 'ZONE', '품명', '도금', '규격', '현재고', '단위', '원본 JSON'],
    items.map((item) => ({
      visible: [
        item.id,
        item.category,
        item.name,
        item.plating || '',
        item.spec || '',
        roundToInt(item.currentStock, 0),
        item.unit || 'EA',
      ],
      source: item,
    }))
  );
  addSourceSheet(
    'DB_거래원본',
    '수불 거래 원본 데이터 (DB 복구용)',
    ['ID', '일자', 'ZONE', '유형', '품명', '수량(EA)', '작업자', '부서', '사유', '원본 JSON'],
    transactions.map((tx) => ({
      visible: [
        tx.id,
        tx.date,
        tx.category,
        tx.type,
        tx.itemName,
        roundToInt(tx.quantity, 0),
        tx.worker,
        tx.department,
        tx.reason,
      ],
      source: tx,
    }))
  );
  addSourceSheet(
    'DB_기준정보',
    'ZONE 및 품목 기준정보 원본 (DB 복구용)',
    ['기준정보 항목', '원본 JSON'],
    Object.entries(masterData).map(([key, value]) => ({
      visible: [key],
      source: { key, value },
    }))
  );
  addSourceSheet(
    'DB_ZONE아카이브',
    'ZONE 아카이브 목록 (DB 복구용)',
    ['아카이브 ID', 'ZONE', '상태', '품목 수', '수불 수', '원본 JSON'],
    zoneArchives.map((archive) => ({
      visible: [
        archive.id,
        archive.displayName,
        archive.status,
        archive.itemCount,
        archive.transactionCount,
      ],
      source: {
        ...archive,
        inventory: undefined,
        transactions: undefined,
      },
    }))
  );
  addSourceSheet(
    'DB_ZONE아카이브원본',
    'ZONE 아카이브 품목·수불 원본 (DB 복구용)',
    ['아카이브 ID', '자료 유형', '레코드 ID', '원본 JSON'],
    zoneArchives.flatMap((archive) => [
      ...archive.inventory.map((item) => ({
        visible: [archive.id, 'inventory', item.id],
        source: { archiveId: archive.id, recordType: 'inventory', record: item },
      })),
      ...archive.transactions.map((tx) => ({
        visible: [archive.id, 'transaction', tx.id],
        source: { archiveId: archive.id, recordType: 'transaction', record: tx },
      })),
    ])
  );

  const fileName = `KDT-Inventory-${targetYear}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  const exportBuffer = await workbook.xlsx.writeBuffer();
  const exportBlob = new Blob([exportBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(exportBlob, fileName);

  return { unassignedCount: 0, fileName, targetYear };
}
