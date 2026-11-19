import React, { useState, useRef } from 'react';
import { read, utils } from 'xlsx';
import { Upload, ArrowRight, CheckCircle, FileText, Check, X, ClipboardList, AlertTriangle, RefreshCw, Calendar, Database, Search, AlertCircle, Loader2, Bug } from 'lucide-react';
import { InventoryTransaction, InventoryItem } from '../types';
import { ActionLogger } from '../utils/logger';
import ConfirmationModal from './ConfirmationModal';

interface TransactionHistoryImportProps {
   onImport: (transactions: InventoryTransaction[]) => void;
   onCancel: () => void;
   inventory: InventoryItem[];
}

const TransactionHistoryImport: React.FC<TransactionHistoryImportProps> = ({ onImport, onCancel, inventory }) => {
   const [step, setStep] = useState<1 | 2 | 3>(1);
   const [file, setFile] = useState<File | null>(null);

   // Loading & Progress State
   const [isProcessing, setIsProcessing] = useState(false);
   const [showLoadingModal, setShowLoadingModal] = useState(false);
   const [progress, setProgress] = useState<{ current: number; total: number; currentSheetName: string }>({ current: 0, total: 0, currentSheetName: '' });

   // Analysis State
   const [analysisReport, setAnalysisReport] = useState<{
      totalSheets: number;
      processedSheets: number;
      dateRange: { start: string; end: string; detectedDays: number };
      totalTransactions: number;
      matchedItemsCount: number;
      unmatchedItems: string[];
      isFullYear: boolean;
      problematicRows: Array<{ sheet: string; row: number; value: string; reason: string }>;
      carryOverRows: Array<{ sheet: string; itemName: string; quantity: number; date: string }>;
      carryOverFixes: Array<{ sheet: string; itemName: string; before: number; expected: number; inQty: number; outQty: number; balanceQty: number }>;
      carryOverMissingJan1: Array<{ sheet: string; itemName: string; carryQty: number }>;
      debugLog: string[]; // [DEBUG] Added
   } | null>(null);

   const [previewData, setPreviewData] = useState<InventoryTransaction[]>([]);
   const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode; isDangerous?: boolean } | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);

   // Helper: Clean numbers
   const cleanNumber = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/,/g, '').trim();
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
   };

   // Helper: Normalize String for Matching (Remove all spaces)
   const normalizeStr = (str: string) => String(str || '').replace(/\s+/g, '').trim();

   /**
    * Resolve Merged Cells
    */
   const resolveMergedCells = (ws: any) => {
      if (!ws['!merges']) return;

      ws['!merges'].forEach((merge: any) => {
         const startRef = utils.encode_cell(merge.s);
         const startCell = ws[startRef];

         if (startCell) {
            for (let r = merge.s.r; r <= merge.e.r; r++) {
               for (let c = merge.s.c; c <= merge.e.c; c++) {
                  const targetRef = utils.encode_cell({ c, r });
                  if (!ws[targetRef]) {
                     ws[targetRef] = { ...startCell };
                  }
               }
            }
         }
      });
      delete ws['!merges'];
   };

   /**
    * Process ALL Sheets Sequentially (Ver 3.1.1 Logic Restored + English/Debug/Safety)
    */
   const processAllSheetsMatrix = async (wb: any, options?: { setState?: boolean }) => {
      try {
         const sheetNames = wb.SheetNames;
         const totalSheets = sheetNames.length;

         // Initialize Progress
         setShowLoadingModal(true);
         setProgress({ current: 0, total: totalSheets, currentSheetName: '준비 중...' });

         // Accumulators
         const allTransactions: InventoryTransaction[] = [];
         const unmatchedItemsSet = new Set<string>();
         const uniqueDates = new Set<string>();
         const problematicRows: Array<{ sheet: string; row: number; value: string; reason: string }> = [];
         const carryOverRows: Array<{ sheet: string; itemName: string; quantity: number; date: string }> = [];
         const carryOverFixes: Array<{ sheet: string; itemName: string; before: number; expected: number; inQty: number; outQty: number; balanceQty: number }> = [];
         const carryOverMissingJan1: Array<{ sheet: string; itemName: string; carryQty: number }> = [];
         let processedSheetCount = 0; // [FIXIED] Variable restored

         const debugLogs: string[] = []; // [DEBUG]

         // Pre-compute normalized inventory map (Index both displayKey "name [plating/spec]" and plain name)
         const buildDisplayKey = (it: InventoryItem) => {
            const parts = [it.plating?.trim(), it.spec?.trim()].filter(Boolean);
            return parts.length > 0 ? `${it.name} [${parts.join('/')}]` : it.name;
         };
         const inventoryMap = new Map<string, InventoryItem[]>();
         const pushToMap = (rawKey: string, it: InventoryItem) => {
            const k = normalizeStr(rawKey);
            if (!k) return;
            if (!inventoryMap.has(k)) inventoryMap.set(k, []);
            inventoryMap.get(k)!.push(it);
         };
         inventory.forEach(item => {
            pushToMap(buildDisplayKey(item), item);
            pushToMap(item.name, item);
         });

         // Detect global workbook year from first sheet if available
         let workbookYear = new Date().getFullYear();
         if (sheetNames.length > 0) {
            const firstWs = wb.Sheets[sheetNames[0]];
            if (firstWs) {
               const firstData = utils.sheet_to_json(firstWs, { header: 1 }) as any[][];
               for (let r = 0; r < Math.min(5, firstData.length); r++) {
                  const rowStr = (firstData[r] || []).join(' ');
                  const m = rowStr.match(/(\d{4})년/) || rowStr.match(/Year\s*(\d{4})/i);
                  if (m) {
                     workbookYear = parseInt(m[1], 10);
                     break;
                  }
               }
            }
         }

         // --- Loop through sheets one by one ---
         for (let i = 0; i < totalSheets; i++) {
            const sheetName = sheetNames[i];
            const normalizedSheetName = normalizeStr(sheetName);

            // 1. Update Progress UI
            setProgress({ current: i + 1, total: totalSheets, currentSheetName: sheetName });
            await new Promise(resolve => setTimeout(resolve, 50));

            const ws = wb.Sheets[sheetName];
            if (!ws) continue;

            // 2. Process Data
            resolveMergedCells(ws);
            const data = utils.sheet_to_json(ws, { header: 1 }) as any[][];

            // [RESTORED Header Logic] + Added English Support
            const headerRowIndex = data.findIndex((row, idx) =>
               idx < 50 &&
               (
                  (row.some(cell => normalizeStr(cell) === '입고') && row.some(cell => normalizeStr(cell) === '출고')) ||
                  (row.some(cell => /^(in|inbox)$/i.test(normalizeStr(cell))) && row.some(cell => /^(out|outbox)$/i.test(normalizeStr(cell))))
               )
            );

            if (headerRowIndex !== -1) {
               processedSheetCount++; // [FIXED] Increment count
               debugLogs.push(`[${sheetName}] Header Found at Row ${headerRowIndex + 1}`);
               debugLogs.push(`[${sheetName}] Row Count: ${data.length}`);

               // Extract Year (from sheet header or workbookYear)
               let year = workbookYear;
               for (let r = 0; r <= headerRowIndex; r++) {
                  const rowStr = (data[r] || []).join(' ');
                  const yMatch = rowStr.match(/(\d{4})년/) || rowStr.match(/Year\s*(\d{4})/i);
                  if (yMatch) {
                     year = parseInt(yMatch[1]);
                     break;
                  }
               }
               debugLogs.push(`[${sheetName}] Header Year: ${year}`);

               // Map Columns
               const typeRow = data[headerRowIndex];
               let nameRow = null;

               // Search upwards for item name row
               for (let k = 1; k <= 5; k++) {
                  if (headerRowIndex - k >= 0) {
                     const potentialRow = data[headerRowIndex - k];
                     const rowString = potentialRow.map(c => String(c || '')).join('');

                     if (rowString.includes('기존재고') || rowString.includes('이월') || rowString.toLowerCase().includes('carry-over')) continue;

                     const hasNames = typeRow.some((type, idx) => {
                        const cleanType = normalizeStr(type).toLowerCase();
                        return (cleanType === '입고' || cleanType === '출고' || cleanType === 'in' || cleanType === 'out') &&
                           potentialRow[idx] &&
                           String(potentialRow[idx]).trim().length > 0;
                     });

                     if (hasNames) {
                        nameRow = potentialRow;
                        break;
                     }
                  }
               }

               if (nameRow) {
                  const matchItem = (excelName: string) => {
                     const normalizedExcelItemName = normalizeStr(excelName);
                     const dbItems = inventoryMap.get(normalizedExcelItemName);
                     if (!dbItems || dbItems.length === 0) return null;
                     // Strictly prefer item belonging to the current ZONE sheet first (cross-ZONE duplicate protection)
                     let matchedItem = dbItems.find(item =>
                        normalizeStr(item.category) === normalizedSheetName ||
                        normalizedSheetName.includes(normalizeStr(item.category))
                     );
                     if (!matchedItem) matchedItem = dbItems[0];
                     return matchedItem;
                  };

                  const colMap: { [index: number]: { name: string, type: 'IN' | 'OUT' } } = {};
                  let currentItemName = '';

                  for (let c = 1; c < typeRow.length; c++) {
                     const rawName = nameRow[c];
                     if (rawName) currentItemName = String(rawName).trim();

                     const colType = normalizeStr(typeRow[c]).toLowerCase();
                     if (currentItemName && (colType === '입고' || colType === '출고' || colType === 'in' || colType === 'out')) {
                        colMap[c] = {
                           name: currentItemName,
                           type: (colType === '입고' || colType === 'in') ? 'IN' : 'OUT'
                        };
                     }
                  }

                  let carryRowIndex = -1;
                  let carryRow = null;
                  
                  for (let k = -1; k <= 2; k++) {
                     const rIdx = headerRowIndex + k;
                     if (rIdx >= 0 && rIdx < data.length) {
                        const row = data[rIdx];
                        const isCarry = row.some(cell => {
                           const s = normalizeStr(cell || '').toLowerCase();
                           return s.includes('기존재고') || s.includes('이월') || s.includes('carry-over') || s.includes('carryover') || s.includes('기초재고');
                        });
                        if (isCarry) {
                           carryRowIndex = rIdx;
                           carryRow = row;
                           break;
                        }
                     }
                  }

                  const carryDate = `${year}-01-01`;
                  const carryKeyMap = new Map<string, { txIndex: number; reportIndex: number; qty: number; sheet: string; itemName: string }>();
                  const jan1Stats = new Map<string, { inQty: number; outQty: number; balanceQty: number | null; sheet: string; itemName: string }>();

                  if (carryRow) {
                     uniqueDates.add(carryDate);

                     const isCarryRow = carryRow.some(cell => {
                        const s = normalizeStr(cell || '').toLowerCase();
                        return s.includes('기존재고') || s.includes('이월') || s.includes('carry-over') || s.includes('carryover') || s.includes('기초재고');
                     });

                     if (!isCarryRow) {
                        return; // 이 행은 이월 데이터가 아님
                     }

                     Object.entries(colMap).forEach(([colIdxStr, info]) => {
                        if (info.type !== 'IN') return; // 입/출고 컬럼 쌍이므로 IN일 때 한 번만 이월 재고를 추출하면 됨

                        const colIdx = Number(colIdxStr);
                        const balanceIdx = colIdx + 2;
                        
                        // 이월 수량이 '재고' 열에 적혀있을 수도 있고, '입고' 열에 적혀있을 수도 있음. 둘 중 하나라도 값이 있으면 사용.
                        const qtyBal = cleanNumber(carryRow[balanceIdx]);
                        const qtyIn = cleanNumber(carryRow[colIdx]);
                        const qty = qtyBal > 0 ? qtyBal : qtyIn;

                        // 수량이 0인 경우도 초기화 명목으로 포함할 수 있으나, 보통 0보다 큰 경우에만 유의미함. (하지만 0이어도 내역을 남기기 위해 추출)

                        const matchedItem = matchItem(info.name);
                        if (matchedItem) {
                           const txIndex = allTransactions.length;
                           allTransactions.push({
                              id: `CARRY-${sheetName}-${carryRowIndex}-${balanceIdx}`,
                              itemId: matchedItem.id,
                              itemName: matchedItem.name,
                              category: matchedItem.category,
                              date: carryDate,
                              type: 'IN',
                              quantity: qty,
                              worker: '일괄등록',
                              department: '관리팀',
                              reason: '재고이월',
                              currentStockSnapshot: 0
                           });

                           const reportIndex = carryOverRows.push({
                              sheet: sheetName,
                              itemName: matchedItem.name,
                              quantity: qty,
                              date: carryDate
                           }) - 1;

                           carryKeyMap.set(`${sheetName}||${matchedItem.id}`, {
                              txIndex,
                              reportIndex,
                              qty,
                              sheet: sheetName,
                              itemName: matchedItem.name
                           });
                        } else {
                           unmatchedItemsSet.add(info.name);
                        }
                     });
                  }

                  for (let r = headerRowIndex + 1; r < data.length; r++) {
                     if (r === carryRowIndex) continue;
                     const row = data[r];
                     // [SAFETY FIX] Skip undefined rows to prevent crashing
                     if (!row) continue;

                     const rawDateVal = row[0];
                     const dateCellStr = String(rawDateVal || '').trim();

                     // [RESTORED Skip Logic] + Added English Keywords
                     const skipKeywords = ['계', '일자', '구 분', '구  분', '월 계', '연 계', '기존재고', 'total', 'monthly', 'year', 'date', 'monthly total', 'yearly total'];
                     if (!dateCellStr || skipKeywords.some(k => normalizeStr(dateCellStr).toLowerCase().includes(normalizeStr(k).toLowerCase()))) {
                        // [DEBUG]
                        if (r < headerRowIndex + 10) debugLogs.push(`[${sheetName}] Row ${r + 1} Skipped: ${dateCellStr || 'EMPTY'}`);
                        continue;
                     }

                     let dateString = '';
                     let isValidRow = false;
                     let isJan1 = false;
                     let numVal = Number(dateCellStr);

                     if (!isNaN(numVal) && numVal > 30000) {
                        const dateObj = new Date((numVal - 25569) * 86400 * 1000);
                        dateString = dateObj.toISOString().slice(0, 10);
                        isValidRow = true;
                     } else {
                        // Regex for YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
                        const isoMatch = dateCellStr.match(/^(\d{2,4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);

                        if (isoMatch) {
                           let y = parseInt(isoMatch[1]);
                           if (y < 100) y += 2000; // 25 -> 2025

                           const m = isoMatch[2].padStart(2, '0');
                           const d = isoMatch[3].padStart(2, '0');
                           dateString = `${y}-${m}-${d}`;
                           isValidRow = true;
                        } else {
                           // Regex for MM월 DD일
                           const monthDayMatch = dateCellStr.match(/^(\d{1,2})월\s*(\d{1,2})일/);
                           if (monthDayMatch) {
                              const m = parseInt(monthDayMatch[1]);
                              const d = parseInt(monthDayMatch[2]);
                              dateString = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                              // Validate logical date
                              const testDate = new Date(year, m - 1, d);
                              if (testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
                                 problematicRows.push({
                                    sheet: sheetName,
                                    row: r + 1,
                                    value: dateCellStr,
                                    reason: `달력에 없는 날짜 (${year}년)`
                                 });
                              } else {
                                 isValidRow = true;
                              }
                           } else {
                              // [ENHANCEMENT] Try JS Date Constructor for other formats
                              const fallbackDate = new Date(dateCellStr);
                              if (!isNaN(fallbackDate.getTime()) && fallbackDate.getFullYear() > 2000) {
                                 dateString = fallbackDate.toISOString().slice(0, 10);
                                 isValidRow = true;
                              }
                           }
                        }
                     }

                     if (r < headerRowIndex + 10) debugLogs.push(`[${sheetName}] Row ${r + 1} Parsed: ${dateString} (Valid: ${isValidRow})`);

                     if (isValidRow && dateString) {
                        const isJan1 = dateString === carryDate;
                        uniqueDates.add(dateString);
                        Object.entries(colMap).forEach(([colIdxStr, info]) => {
                           const colIdx = Number(colIdxStr);
                           const qty = cleanNumber(row[colIdx]);
                           const matchedItem = matchItem(info.name);
                           if (!matchedItem) {
                              unmatchedItemsSet.add(info.name);
                              return;
                           }

                           if (isJan1) {
                              const statsKey = `${sheetName}||${matchedItem.id}`;
                              const existing = jan1Stats.get(statsKey) || { inQty: 0, outQty: 0, balanceQty: null, sheet: sheetName, itemName: matchedItem.name };
                              if (qty > 0) {
                                 if (info.type === 'IN') existing.inQty += qty;
                                 if (info.type === 'OUT') existing.outQty += qty;
                              }
                              const balanceIdx = colIdx + 2;
                              const balanceHeader = normalizeStr(typeRow[balanceIdx] || '').toLowerCase();
                              if (balanceHeader === '재고' || balanceHeader === 'balance') {
                                 const bal = cleanNumber(row[balanceIdx]);
                                 existing.balanceQty = bal;
                              }
                              jan1Stats.set(statsKey, existing);
                           }

                           if (qty > 0) {
                              allTransactions.push({
                                 id: `BATCH-${sheetName}-${r}-${colIdx}`,
                                 itemId: matchedItem.id,
                                 itemName: matchedItem.name,
                                 category: matchedItem.category,
                                 date: dateString,
                                 type: info.type,
                                 quantity: qty,
                                 worker: '일괄등록',
                                 department: '관리팀',
                                 reason: info.type === 'IN' ? '수불부 입고' : '수불부 사용',
                                 currentStockSnapshot: 0
                              });
                           }
                        });
                     } else if (dateCellStr.match(/\d/)) {
                        problematicRows.push({
                           sheet: sheetName,
                           row: r + 1,
                           value: dateCellStr,
                           reason: '날짜 형식 불일치'
                        });
                     }
                  }

                  carryKeyMap.forEach((carryInfo, key) => {
                     const stat = jan1Stats.get(key);
                     if (!stat || stat.balanceQty === null || stat.balanceQty === undefined) {
                        carryOverMissingJan1.push({
                           sheet: carryInfo.sheet,
                           itemName: carryInfo.itemName,
                           carryQty: carryInfo.qty
                        });
                        return;
                     }
                     if (stat.inQty > 0 || stat.outQty > 0) {
                        return;
                     }
                     if (stat.balanceQty === 0) {
                        // [CRITICAL FIX] 1월 1일 재고 셀이 비어있어서 0으로 파싱된 경우, 정상적인 이월 수량을 0으로 덮어쓰지 않도록 방어.
                        return;
                     }
                     const expected = Math.max(0, Number((stat.balanceQty - stat.inQty + stat.outQty).toFixed(3)));
                     if (Math.abs(expected - carryInfo.qty) > 1e-6) {
                        const tx = allTransactions[carryInfo.txIndex];
                        if (tx) {
                           tx.quantity = expected;
                        }
                        const reportRow = carryOverRows[carryInfo.reportIndex];
                        if (reportRow) {
                           reportRow.quantity = expected;
                        }
                        carryOverFixes.push({
                           sheet: carryInfo.sheet,
                           itemName: carryInfo.itemName,
                           before: carryInfo.qty,
                           expected,
                           inQty: stat.inQty,
                           outQty: stat.outQty,
                           balanceQty: stat.balanceQty
                        });
                     }
                  });
               } else {
                  debugLogs.push(`[${sheetName}] Name Row Not Found`);
               }

               // [SAFETY] Memory Cleanup
               if (wb.Sheets[sheetName]) delete wb.Sheets[sheetName];
            } else {
               // debugLogs.push(`[${sheetName}] Header Not Found`);
            }
         }

         // --- Analysis & State Update ---
         const datesArray = Array.from(uniqueDates).sort();
         const startDate = datesArray[0] || '-';
         const endDate = datesArray[datesArray.length - 1] || '-';
         const detectedDays = uniqueDates.size;
         const isFullYear = detectedDays >= 365;

         const filteredTransactions = allTransactions.filter(tx => !(tx.reason === '재고이월' && tx.quantity <= 0));
         const filteredCarryRows = carryOverRows.filter(row => row.quantity > 0);
         const report = {
            totalSheets: wb.SheetNames.length,
            processedSheets: processedSheetCount,
            dateRange: { start: startDate, end: endDate, detectedDays },
            totalTransactions: filteredTransactions.length,
            matchedItemsCount: inventory.length - unmatchedItemsSet.size,
            unmatchedItems: Array.from(unmatchedItemsSet),
            isFullYear,
            problematicRows,
            carryOverRows: filteredCarryRows,
            carryOverFixes,
            carryOverMissingJan1,
            debugLog: debugLogs
         };

         if (options?.setState !== false) {
            setAnalysisReport(report);
            setPreviewData(filteredTransactions);
            setStep(3);
            setShowLoadingModal(false);
         }

         return { transactions: filteredTransactions, report };

      } catch (e: any) {
         console.error("Matrix Processing Error", e);
         const errorMsg = e instanceof Error ? e.message : String(e);
         setAlertModal({
            title: '파일 처리 오류',
            message: `파일 처리 중 오류가 발생했습니다.\n\n오류 내용: ${errorMsg}\n\n문제가 지속되면 디버그 정보를 확인해주세요.`
         });
         setStep(1);
         setShowLoadingModal(false);
         return { transactions: [], report: null };
      }
   };

   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFile = e.target.files?.[0];
      if (uploadedFile) {
         setFile(uploadedFile);
         setIsProcessing(true);
         setShowLoadingModal(true);
         setProgress({ current: 0, total: 0, currentSheetName: '파일 읽는 중...' });

         const reader = new FileReader();
         reader.onload = async (evt) => {
            const bstr = evt.target?.result;

            setTimeout(async () => {
               try {
                  const wb = read(bstr, { type: 'binary' });
                  await processAllSheetsMatrix(wb);
               } catch (err: any) {
                  console.error(err);
                  setAlertModal({
                     title: '파일 읽기 오류',
                     message: `파일을 읽는 중 오류가 발생했습니다: ${err?.message || err}`
                  });
                  setShowLoadingModal(false);
               } finally {
                  setIsProcessing(false);
               }
            }, 100);
         };
         reader.readAsBinaryString(uploadedFile);
      }
   };

   const handleConfirm = () => {
      ActionLogger.log('History Batch Imported', {
         count: previewData.length,
         sheets: analysisReport?.processedSheets
      });
      onImport(previewData);
   };

   return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full flex flex-col animate-fade-in overflow-hidden transition-colors relative">
         {/* Header */}
         <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <div>
               <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ClipboardList className="text-purple-600 dark:text-purple-400" />
                  입출고 일괄등록 (수불부) <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">Simple v3.1 Fixed3</span>
               </h2>
               <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  수불부 엑셀 파일을 업로드하여 전체 입고 및 출고 이력을 검증하고 등록합니다.
               </p>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">닫기</button>
            </div>
         </div>

         {/* Body */}
         <div className="flex-1 overflow-auto p-6 relative">
            {step === 1 && (
               <div className={`h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}>
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={isProcessing} title="수불부 엑셀 파일 업로드" aria-label="수불부 엑셀 파일 업로드" />
                  <div className="bg-white dark:bg-slate-700 p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                     <Upload size={32} className="text-purple-500 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">엑셀 파일 업로드</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm text-center">
                     요양원 수불부 통합 파일(.xlsx)을 선택하세요.<br />
                     모든 시트를 순회하며 날짜 및 입출고 데이터를 추출합니다.
                  </p>
               </div>
            )}

            {/* Loading Overlay with Progress */}
            {showLoadingModal && (
               <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-center animate-fade-in rounded-xl">
                  <div className="flex flex-col items-center p-8 w-full max-w-sm">
                     <Loader2 size={48} className="text-purple-600 dark:text-purple-400 animate-spin mb-6" />
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">데이터 분석 중...</h3>

                     {progress.total > 0 ? (
                        <div className="w-full space-y-2">
                           <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                              <span>진행 상황</span>
                              <span className="font-mono font-bold">{Math.round((progress.current / progress.total) * 100)}%</span>
                           </div>
                           <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                 className="h-full bg-purple-600 transition-all duration-300"
                                 style={{ width: `${(progress.current / progress.total) * 100}%` }}
                              ></div>
                           </div>
                           <p className="text-xs text-center text-slate-500 mt-2 truncate">
                              현재 시트: {progress.currentSheetName} ({progress.current}/{progress.total})
                           </p>
                        </div>
                     ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                           파일을 읽고 준비하고 있습니다...<br />
                           잠시만 기다려주세요.
                        </p>
                     )}
                  </div>
               </div>
            )}

            {step === 3 && analysisReport && (
               <div className="max-w-4xl mx-auto h-full flex flex-col">

                  {/* Validation Report Card */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden mb-6">
                     <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                           <CheckCircle className="text-green-600" size={18} />
                           데이터 검증 리포트
                        </h3>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                           총 {analysisReport.processedSheets}개 시트 처리 완료
                        </span>
                     </div>

                     <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Date Range & Full Year Validation */}
                        <div className="space-y-2">
                           <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Calendar size={16} /> 기간 및 일수 검증
                           </h4>
                           <div className={`p-4 rounded-lg border ${analysisReport.isFullYear ? 'bg-green-50 border-green-100 dark:bg-green-900/20' : 'bg-red-50 border-red-100 dark:bg-red-900/20'}`}>
                              <div className="flex justify-between text-sm mb-2">
                                 <span className="text-slate-500">인식된 기간:</span>
                                 <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {analysisReport.dateRange.start} ~ {analysisReport.dateRange.end}
                                 </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                 <span className="text-slate-500">인식된 날짜 수:</span>
                                 {analysisReport.isFullYear ? (
                                    <span className="font-bold text-green-600 flex items-center gap-1">
                                       <Check size={14} /> {analysisReport.dateRange.detectedDays}일 (365일 이상)
                                    </span>
                                 ) : (
                                    <span className="font-bold text-red-600 flex items-center gap-1">
                                       <AlertTriangle size={14} /> {analysisReport.dateRange.detectedDays}일 (365일 미만)
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>

                        {/* 2. Problematic Rows Reporting */}
                        <div className="space-y-2">
                           <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <AlertCircle size={16} /> 검출된 날짜 오류 ({analysisReport.problematicRows.length}건)
                           </h4>
                           <div className={`p-4 rounded-lg border h-32 overflow-y-auto custom-scrollbar ${analysisReport.problematicRows.length > 0 ? 'bg-orange-50 border-orange-100 dark:bg-orange-900/20' : 'bg-slate-50 border-slate-100 dark:bg-slate-800'}`}>
                              {analysisReport.problematicRows.length > 0 ? (
                                 <ul className="space-y-2">
                                    {analysisReport.problematicRows.map((err, idx) => (
                                       <li key={idx} className="text-xs text-orange-800 dark:text-orange-200 border-b border-orange-200 dark:border-orange-800 last:border-0 pb-1">
                                          <span className="font-bold">[{err.sheet}] {err.row}행:</span> "{err.value}" <br />
                                          <span className="text-orange-600 dark:text-orange-400">- {err.reason}</span>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="text-slate-400 text-xs flex items-center justify-center h-full">
                                    발견된 날짜 오류가 없습니다.
                                 </div>
                              )}
                           </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                           <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <AlertTriangle size={16} /> 재고이월 항목 ({analysisReport.carryOverRows.length}건)
                           </h4>
                           <div className={`p-4 rounded-lg border h-32 overflow-y-auto custom-scrollbar ${analysisReport.carryOverRows.length > 0 ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20' : 'bg-slate-50 border-slate-100 dark:bg-slate-800'}`}>
                              {analysisReport.carryOverRows.length > 0 ? (
                                 <ul className="space-y-2">
                                    {analysisReport.carryOverRows.slice(0, 20).map((row, idx) => (
                                       <li key={`${row.sheet}-${row.itemName}-${idx}`} className="text-xs text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-800 last:border-0 pb-1">
                                          <span className="font-bold">[{row.sheet}]</span> {row.date} / {row.itemName} / {row.quantity}
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="text-slate-400 text-xs flex items-center justify-center h-full">
                                    불일치 항목이 없습니다.
                                 </div>
                              )}
                           </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                           <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <AlertTriangle size={16} /> 재고이월 검증 결과 (수정 {analysisReport.carryOverFixes.length}건 / 미검증 {analysisReport.carryOverMissingJan1.length}건)
                           </h4>
                           <div className={`p-4 rounded-lg border h-32 overflow-y-auto custom-scrollbar ${analysisReport.carryOverFixes.length > 0 || analysisReport.carryOverMissingJan1.length > 0 ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20' : 'bg-slate-50 border-slate-100 dark:bg-slate-800'}`}>
                              {(analysisReport.carryOverFixes.length > 0 || analysisReport.carryOverMissingJan1.length > 0) ? (
                                 <ul className="space-y-2">
                                    {analysisReport.carryOverFixes.slice(0, 12).map((row, idx) => (
                                       <li key={`fix-${row.sheet}-${row.itemName}-${idx}`} className="text-xs text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-800 last:border-0 pb-1">
                                          <span className="font-bold">[{row.sheet}]</span> {row.itemName} / 이월 {row.before} → {row.expected} (1/1 재고 {row.balanceQty}, 입고 {row.inQty}, 출고 {row.outQty})
                                       </li>
                                    ))}
                                    {analysisReport.carryOverMissingJan1.slice(0, 8).map((row, idx) => (
                                       <li key={`miss-${row.sheet}-${row.itemName}-${idx}`} className="text-xs text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-800 last:border-0 pb-1">
                                          <span className="font-bold">[{row.sheet}]</span> {row.itemName} / 1월 1일 행 미검출 (이월 {row.carryQty})
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <div className="text-slate-400 text-xs flex items-center justify-center h-full">
                                    검증 오류가 없습니다.
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* 3. Debug Log (Collapsible Details) */}
                     {analysisReport.debugLog && analysisReport.debugLog.length > 0 && (
                        <div className="px-6 pb-6">
                           <details className="text-xs">
                              <summary className="cursor-pointer text-slate-500 font-bold hover:text-slate-700 flex items-center gap-2 mb-2">
                                 <Bug size={14} /> 디버그 로그 확인 (문제가 있을 경우 눌러보세요)
                              </summary>
                              <div className="p-3 bg-slate-900 text-slate-300 rounded font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                                 {analysisReport.debugLog.join('\n')}
                              </div>
                           </details>
                        </div>
                     )}

                     {/* 4. Item Match Info (Full Width) */}
                     <div className="px-6 pb-6 pt-0">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm">
                           <div className="flex items-center gap-2">
                              <Database size={16} className="text-slate-500" />
                              <span>품목 매칭: </span>
                              <span className={analysisReport.unmatchedItems.length > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                 {analysisReport.matchedItemsCount}개 매칭 / {analysisReport.unmatchedItems.length}개 미매칭
                              </span>
                           </div>
                           {analysisReport.unmatchedItems.length > 0 && (
                              <span className="text-xs text-red-500 truncate max-w-md" title={analysisReport.unmatchedItems.join(', ')}>
                                 (미매칭: {analysisReport.unmatchedItems.slice(0, 3).join(', ')} 등)
                              </span>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Data Preview */}
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                     <Search size={16} /> 데이터 미리보기 (상위 50건)
                  </h4>
                  <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 mb-4">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                           <tr>
                              <th className="px-3 py-2 border-b dark:border-slate-700">날짜</th>
                              <th className="px-3 py-2 border-b dark:border-slate-700">카테고리</th>
                              <th className="px-3 py-2 border-b dark:border-slate-700">품목명</th>
                              <th className="px-3 py-2 border-b dark:border-slate-700 text-center">구분</th>
                              <th className="px-3 py-2 border-b dark:border-slate-700 text-right">수량</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                           {previewData.slice(0, 50).map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                 <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.date}</td>
                                 <td className="px-3 py-2 text-xs text-slate-500">{row.category}</td>
                                 <td className="px-3 py-2 font-medium">{row.itemName}</td>
                                 <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.type === 'IN' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                       {row.type === 'IN' ? '입고' : '출고'}
                                    </span>
                                 </td>
                                 <td className="px-3 py-2 text-right font-bold">{Number(row.quantity).toFixed(1)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 shrink-0 pb-4">
                     <button
                        onClick={() => setStep(1)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                     >
                        <RefreshCw size={16} className="inline mr-2" />
                        다시 올리기
                     </button>
                     <button
                        onClick={handleConfirm}
                        disabled={previewData.length === 0}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
                     >
                        <CheckCircle size={18} />
                        등록 완료 ({previewData.length.toLocaleString()}건)
                     </button>
                  </div>
               </div>
            )}
         </div>
      {alertModal && (
         <ConfirmationModal
            title={alertModal.title}
            message={alertModal.message}
            confirmLabel="확인"
            isDangerous={alertModal.isDangerous}
            onConfirm={() => setAlertModal(null)}
         />
      )}
      </div>
   );
};

export default TransactionHistoryImport;
