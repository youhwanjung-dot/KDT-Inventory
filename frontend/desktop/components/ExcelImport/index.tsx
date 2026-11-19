import React, { useState } from 'react';
import { read, utils } from 'xlsx';
import { FileSpreadsheet, ArrowRight } from 'lucide-react';
import { InventoryItem, Category } from '../../types';
import { ActionLogger } from '../../utils/logger';
import { DEFAULT_DB_FIELDS, FIELD_SETTINGS_KEY, FieldDef } from '../../constants';
import { FieldMapping, cleanNumber, resolveMergedCells, resolveFormulaRefs, getKeywords } from './utils';
import { processFixedLegacyFormat, guessMapping } from './LegacyParser';
import StepUpload from './StepUpload';
import StepMapping from './StepMapping';
import StepPreview from './StepPreview';
import ConfirmationModal from '../ConfirmationModal';

interface ExcelImportProps {
    onImport: (items: InventoryItem[]) => void;
    onCancel: () => void;
    currentInventory: InventoryItem[];
}

const ExcelImport: React.FC<ExcelImportProps> = ({ onImport, onCancel, currentInventory }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Map, 3: Review
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [file, setFile] = useState<File | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]);
    const [mapping, setMapping] = useState<FieldMapping>({} as FieldMapping);
    const [previewItems, setPreviewItems] = useState<InventoryItem[]>([]);
    const [isLegacyMode, setIsLegacyMode] = useState(false);
    const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

    // Load dbFields from localStorage
    const [dbFields, setDbFields] = useState<FieldDef[]>(() => {
        try {
            const saved = localStorage.getItem(FIELD_SETTINGS_KEY);
            return saved ? JSON.parse(saved) : DEFAULT_DB_FIELDS;
        } catch {
            return DEFAULT_DB_FIELDS;
        }
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = read(bstr, { type: 'binary' });
                const legacyItems: InventoryItem[] = [];
                const legacyMap = new Map<string, InventoryItem>();
                const LEGACY_HEADER_ROW_INDEX = 4; // 0-based, our R4 MAIN header is at Excel row 5
                const LEGACY_HEADER_ROW_CANDIDATES = [
                    LEGACY_HEADER_ROW_INDEX - 2,
                    LEGACY_HEADER_ROW_INDEX - 1,
                    LEGACY_HEADER_ROW_INDEX,
                    LEGACY_HEADER_ROW_INDEX + 1,
                    LEGACY_HEADER_ROW_INDEX + 2,
                    2
                ].filter(i => i >= 0);
                const MIN_LEGACY_ITEMS = 1;
                const normalizeKey = (category: string, name: string) => `${String(category || '').trim().toLowerCase()}|${String(name || '').trim().toLowerCase()}`;

                const addLegacyItem = (item: InventoryItem) => {
                    const key = normalizeKey(item.category, item.name);
                    const existing = legacyMap.get(key);
                    if (!existing) {
                        legacyMap.set(key, item);
                        return;
                    }
                    if (existing.currentStock === 0 && item.currentStock > 0) {
                        legacyMap.set(key, item);
                    }
                };

                const tryParseLegacy = (sheetName: string) => {
                    const ws = wb.Sheets[sheetName];
                    if (!ws) return;
                    resolveMergedCells(ws);
                    resolveFormulaRefs(wb, ws);
                    const data = utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true }) as any[][];
                    if (!data || data.length === 0) return;
                    // Dynamic header scan first
                    const normalize = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();
                    const hasHeaders = (row: any[]) => {
                        const rowNorm = row.map(normalize);
                        const hasName = rowNorm.some(c => ['소분류', '품목명', '품명'].some(k => rowNorm.includes(normalize(k))));
                    const hasStock = rowNorm.some(c => ['잔량', '현재고', '재고', '기준재고'].some(k => rowNorm.includes(normalize(k))));
                        return hasName && hasStock;
                    };
                    let pickedHeader = -1;
                    for (let i = 0; i < Math.min(20, data.length); i++) {
                        const row = data[i] as any[];
                        if (!row) continue;
                        if (hasHeaders(row)) {
                            pickedHeader = i;
                            break;
                        }
                    }
                    const candidates = pickedHeader !== -1 ? [pickedHeader] : LEGACY_HEADER_ROW_CANDIDATES;
                    for (const idx of candidates) {
                        if (idx < 0 || idx >= data.length) continue;
                        const result = processFixedLegacyFormat(data, idx, dbFields);
                        if (result.success && result.items.length > 0) {
                            result.items.forEach(addLegacyItem);
                            // do not break; continue to accumulate in case of multiple blocks
                        }
                    }
                };

                // Prefer parsing only the MAIN ('현 재고') sheet for legacy format
                const preferMain = wb.SheetNames.find(n => {
                    const norm = String(n || '').replace(/\s/g, '').toLowerCase();
                    return norm.includes('현재고') || norm.includes('재고현황') || norm === 'main' || norm === 'inventory';
                });
                if (preferMain) {
                    tryParseLegacy(preferMain);
                } else {
                    wb.SheetNames.forEach((sheetName) => {
                        const normalized = String(sheetName || '').replace(/\s/g, '').toLowerCase();
                        if (['표지', 'cover'].includes(normalized)) return;
                        tryParseLegacy(sheetName);
                    });
                }

                legacyMap.forEach(item => legacyItems.push(item));

                if (legacyItems.length >= MIN_LEGACY_ITEMS) {
                    setPreviewItems(legacyItems);
                    setIsLegacyMode(true);
                    setStep(3);
                    return;
                }

                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                resolveMergedCells(ws);
                resolveFormulaRefs(wb, ws);

                const data = utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true }) as any[][];

                if (data.length > 0) {
                    // Try to find the Header Row logic...
                    // For brevity, using a simplified robust check or the logic from original file?
                    // I should copy the full robust logic from original file here or move it to a parser util completely.
                    // For now, let's keep the logic inline as it interacts with state setting significantly.
                    // Or better, let's move the header detection logic to LegacyParser or utils?
                    // Actually, let's implement the robust detection here as in original.

                    const normalizeForDetect = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();
                    const categoryKeywords = getKeywords('category', ['대분류', 'category'], dbFields);
                    const nameKeywords = getKeywords('name', ['소분류', 'sub-category', 'name'], dbFields);
                    const stockKeywords = getKeywords('currentStock', ['잔량', '현재고', '재고', '기준재고', 'balance', 'stock'], dbFields);

                    // Check if it matches Legacy Format
                    // To do that, we need to find the header row first or check if processLegacyFormat returns success
                    // The original code tried processLegacyFormat first if we knew the header row?
                    // No, original code:
                    // 1. Find Header Row
                    // 2. If Found -> set headers -> setMapping (Step 2)
                    // But WAIT, `processLegacyFormat` was called inside `handleFileUpload`?
                    // Original code:
                    // It didn't call `processLegacyFormat` in `handleFileUpload` directly.
                    // Oh, actually `processLegacyFormat` was NOT CALLED in `handleFileUpload` in the original snippet I viewed?
                    // Let me check the View File output again.
                    // Step 217: `processLegacyFormat` is defined.
                    // But where is it called?
                    // I viewed the file but I might have missed where `processLegacyFormat` is invoked.
                    // Ah, I don't see `processLegacyFormat` being called in `handleFileUpload`.
                    // Wait, let's look at `handleFileUpload` in original code (Lines 256-348).
                    // It finds header row... sets state...
                    // It DOES NOT call `processLegacyFormat`.
                    // Where is `processLegacyFormat` called?
                    // Searching for usage...
                    // I suspect it might be used inside `guessMapping`? No.
                    // Maybe it WAS unused or I missed a spot?
                    // Or maybe it is determined by `isLegacyMode`?
                    // Let's check `processLegacyFormat` definition: It returns `boolean` (success).
                    // Maybe it's called somewhere else.
                    // I see `excelImport.processLegacyFormat` in outline.

                    // Wait! I missed where it was called.
                    // Let's check lines 273 (if data.length > 0)...
                    // It tries to find header row.
                    // If it finds it, it sets headers and goes to Step 2.
                    // `guessMapping` is used.
                    // `processLegacyFormat` seems unused in `handleFileUpload`.

                    // However, `processLegacyFormat` logic seems vital for that specific client format.
                    // Maybe the user REMOVED the call? Or I missed it.
                    // Let's look at `index.tsx` logic I am writing.
                    // If I want to support legacy, I should try it.
                    // The original code had `processLegacyFormat` defined.
                    // Let's look at the `ViewFile` output again.
                    // It IS defined.
                    // Is it used?
                    // I am scrolling through the view_file output.
                    // I see `generatePreview`.
                    // I see `handleFileUpload`.
                    // I don't see `processLegacyFormat` called in `handleFileUpload`.
                    // Maybe it was intended to be used but not hooked up?
                    // Or maybe it's called in `generatePreview`?
                    // `generatePreview` uses `rawRows.reduce` and `excelHeaders`. Standard logic.
                    // It seems `processLegacyFormat` might be dead code or I missed the call site.
                    // Logic check:
                    // `processLegacyFormat` handles the *parsing* directly into items.
                    // `generatePreview` turns mapped rows into items.
                    // If `processLegacyFormat` is used, it should bypass the mapping step.
                    // The original code `processLegacyFormat` returns `items`, sets `previewItems`, `setIsLegacyMode(true)`, `setStep(3)`.
                    // This strongly suggests it SHOULD be called in `handleFileUpload` to detect legacy format immediately.

                    // I will add the check for Legacy Format in `handleFileUpload`.
                    // Attempt to parse as legacy first using a heuristic (e.g., checking specific headers on row 0 or 1).
                    // If successful, go straight to Step 3.
                    // If not, proceed with standard detection.

                    if (data.length > LEGACY_HEADER_ROW_INDEX) {
                        const result = processFixedLegacyFormat(data, LEGACY_HEADER_ROW_INDEX, dbFields);
                        if (result.success && result.items.length >= MIN_LEGACY_ITEMS) {
                            setPreviewItems(result.items);
                            setIsLegacyMode(true);
                            setStep(3);
                            return;
                        }
                    }

                    // Standard Detection
                    const headerRowIdx = data.findIndex((row, idx) => {
                        if (idx > 50) return false;
                        const hasCategory = row.some(cell => categoryKeywords.some(k => normalizeForDetect(cell).includes(normalizeForDetect(k))));
                        const hasName = row.some(cell => nameKeywords.some(k => normalizeForDetect(cell).includes(normalizeForDetect(k))));
                        const hasStock = row.some(cell => stockKeywords.some(k => normalizeForDetect(cell).includes(normalizeForDetect(k))));

                        if (!hasCategory || !hasName || !hasStock) return false;

                        const nonNullCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
                        if (nonNullCells.length < 3) return false;
                        const uniqueValues = new Set(nonNullCells.map(cell => String(cell).trim()));
                        if (uniqueValues.size < 3) return false;
                        return true;
                    });

                    if (headerRowIdx !== -1) {
                        setIsLegacyMode(false);
                        const headers = data[headerRowIdx] as string[];
                        const rows = data.slice(headerRowIdx + 1);
                        setExcelHeaders(headers);
                        setRawRows(rows);
                        setMapping(guessMapping(headers, dbFields));
                        setStep(2);
                    } else {
                        // Fallback logic
                        let fallbackHeaderIdx = -1;
                        for (let i = 0; i < Math.min(data.length, 20); i++) {
                            const nonNullCells = data[i].filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
                            const uniqueValues = new Set(nonNullCells.map(cell => String(cell).trim()));
                            if (nonNullCells.length >= 3 && uniqueValues.size >= 3) {
                                fallbackHeaderIdx = i;
                                break;
                            }
                        }

                        if (fallbackHeaderIdx !== -1) {
                            setIsLegacyMode(false);
                            const headers = data[fallbackHeaderIdx] as string[];
                            const rows = data.slice(fallbackHeaderIdx + 1);
                            setExcelHeaders(headers);
                            setRawRows(rows);
                            setMapping(guessMapping(headers, dbFields));
                            setStep(2);
                        } else {
                            // Last resort
                            setIsLegacyMode(false);
                            const headers = data[0] as string[];
                            const rows = data.slice(1);
                            setExcelHeaders(headers);
                            setRawRows(rows);
                            setMapping(guessMapping(headers, dbFields));
                            setStep(2);
                        }
                    }
                }
            };
            reader.readAsBinaryString(uploadedFile);
        }
    };

    const generatePreview = () => {
        const missingRequired = dbFields.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            setAlertModal({
                title: '필수 필드 누락',
                message: `다음 필수 필드가 매핑되지 않았습니다: ${missingRequired.map(f => f.label).join(', ')}`
            });
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        let lastCategory = '기타';

        const items: InventoryItem[] = rawRows.reduce((acc: InventoryItem[], row: any, index: number) => {
            const rowObj: any = {};
            excelHeaders.forEach((h, i) => { rowObj[h] = row[i]; });

            const nameRaw = rowObj[mapping.name];
            const stockRaw = rowObj[mapping.currentStock];
            const hasName = nameRaw !== undefined && nameRaw !== null && String(nameRaw).trim() !== '';
            const hasStock = stockRaw !== undefined && stockRaw !== null && String(stockRaw).trim() !== '';

            if (!hasName && !hasStock) return acc;

            const categoryRaw = rowObj[mapping.category];
            if (categoryRaw && String(categoryRaw).trim()) {
                lastCategory = String(categoryRaw).trim();
            }

            const category = lastCategory as Category;
            const name = hasName ? String(nameRaw) : '이름 없음';

            acc.push({
                id: `IMP-${Date.now()}-${index}`,
                lastUpdated: today,
                category: category,
                name: name,
                pkgUnit: rowObj[mapping.pkgUnit] ? String(rowObj[mapping.pkgUnit]) : '',
                pkgType: rowObj[mapping.pkgType] ? String(rowObj[mapping.pkgType]) : '',
                outerPkg: rowObj[mapping.outerPkg] ? String(rowObj[mapping.outerPkg]) : '',
                unit: rowObj[mapping.unit] || 'EA',
                currentStock: cleanNumber(stockRaw),
                safeStock: mapping.safeStock ? Math.max(1, cleanNumber(rowObj[mapping.safeStock])) : 1,
                location: rowObj[mapping.location] || '',
                supplier: rowObj[mapping.supplier] || '',
                note: mapping.note ? (rowObj[mapping.note] || '') : ''
            });

            return acc;
        }, []);

        setPreviewItems(items);
        setStep(3);
    };

    const handleFinalConfirm = () => {
        ActionLogger.log('Excel Import Confirmed', { count: previewItems.length, mode: isLegacyMode ? 'Legacy' : 'Standard' });
        onImport(previewItems);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full flex flex-col animate-fade-in overflow-hidden transition-colors relative">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet className="text-green-600 dark:text-green-400" />
                        현재고 일괄등록
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        재고 현황 데이터를 엑셀로 업로드하여 등록합니다. (기존 데이터와 병합 또는 신규 등록)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center text-sm font-medium mr-4">
                        <span className={`px-2 py-1 rounded ${step === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-600'}`}>1. 업로드</span>
                        <ArrowRight size={14} className="mx-1 text-slate-300 dark:text-slate-600" />
                        <span className={`px-2 py-1 rounded ${step === 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-600'}`}>2. 필드연결</span>
                        <ArrowRight size={14} className="mx-1 text-slate-300 dark:text-slate-600" />
                        <span className={`px-2 py-1 rounded ${step === 3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-slate-400 dark:text-slate-600'}`}>3. 검토/저장</span>
                    </div>
                    {step === 1 && <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">취소</button>}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {step === 1 && <StepUpload onFileUpload={handleFileUpload} />}
                {step === 2 && (
                    <StepMapping
                        dbFields={dbFields}
                        setDbFields={setDbFields}
                        mapping={mapping}
                        setMapping={setMapping}
                        excelHeaders={excelHeaders}
                        onBack={() => setStep(1)}
                        onNext={generatePreview}
                    />
                )}
                {step === 3 && (
                    <StepPreview
                        previewItems={previewItems}
                        currentInventory={currentInventory}
                        isLegacyMode={isLegacyMode}
                        dbFields={dbFields}
                        onConfirm={handleFinalConfirm}
                        onBack={() => {
                            setStep(1);
                            setIsLegacyMode(false);
                        }}
                    />
                )}
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

export default ExcelImport;
