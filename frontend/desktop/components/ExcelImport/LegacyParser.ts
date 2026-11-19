import { InventoryItem } from '../../types';
import { FieldDef } from '../../constants';
import { getKeywords, cleanNumber, FieldMapping } from './utils';

/**
 * LEGACY FORMAT PARSER
 * Handles the specific customer Excel format:
 * [연번 | 대분류 | 소분류 | 포장단위 | 박스구성 | 소포장 | 잔량(Qty) | 잔량(Unit)]
 */
export const processLegacyFormat = (data: any[][], headerRowIndex: number, dbFields: FieldDef[]): { success: boolean, items: InventoryItem[] } => {
    try {
        const headerRow = data[headerRowIndex];
        const normalize = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();

        const findIndex = (keywords: string[]) =>
            headerRow.findIndex((cell) => keywords.some(k => normalize(cell).includes(normalize(k))));

        // Find key columns using custom labels
        const colIdx = {
            category: findIndex(getKeywords('category', ['대분류'], dbFields)),
            name: findIndex(getKeywords('name', ['소분류'], dbFields)),
            pkgUnit: findIndex(getKeywords('pkgUnit', ['포장단위'], dbFields)),
            // pkgType (장 1팩): 신규 파일의 '소포장개수' OR 과거 파일의 '박스(묶음)구성'
            pkgType: headerRow.findIndex(cell => {
                const n = normalize(cell);
                return n === '소포장개수' || n.includes('박스묶음') || n === '박스구성';
            }),
            // outerPkg (10팩 1박스): 신규 파일의 '박스구성' OR 과거 파일의 '소포장개수'
            outerPkg: headerRow.findIndex((cell, idx) => {
                const n = normalize(cell);
                if (n === '박스구성') return true;
                // 과거 파일 구조(Col 6: 박스(묶음)구성, Col 7: 소포장개수)인 경우에만 소포장개수를 outerPkg로 매핑
                if (n === '소포장개수' && idx > 0 && normalize(headerRow[idx-1]).includes('박스묶음')) return true;
                return false;
            }),
            stock: findIndex(getKeywords('currentStock', ['잔량', '기준재고'], dbFields))
        };

        // Critical columns check
        if (colIdx.name === -1 || colIdx.stock === -1) return { success: false, items: [] };

        // Unit is assumed to be the next column after stock based on the legacy sheet structure
        const unitIdx = colIdx.stock + 1;

        const items: InventoryItem[] = [];
        let lastCategory = '기타';
        const today = new Date().toISOString().split('T')[0];

        // Iterate data rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            // 1. Name Check & Header Skip Logic
            const nameRaw = row[colIdx.name];
            let name = nameRaw ? String(nameRaw).trim() : '';
            const cleanName = name.replace(/\s/g, '');

            // Skip repeated header rows or subtotal/total rows
            if (getKeywords('name', ['소분류', '품목명', '품명'], dbFields).includes(cleanName)) continue;
            if (['소계', '합계', '총계', '계'].some(k => cleanName === k || cleanName.startsWith(k))) continue;

            // 2. Stock Check (to rescue items with empty names)
            const qtyVal = row[colIdx.stock];
            const hasStock = qtyVal !== undefined && qtyVal !== null && String(qtyVal).trim() !== '';

            // Skip truly empty rows (no name AND no stock)
            if (!name && !hasStock) continue;

            // If Name is empty but Stock exists, treat as valid item
            if (!name) name = "품목명 미기재";

            // 3. Category Merge Logic: Fill down
            // Only update lastCategory if the current row HAS a category value
            if (colIdx.category > -1) {
                const catRaw = row[colIdx.category];
                if (catRaw) {
                    const catStr = String(catRaw).trim();
                    // Avoid updating lastCategory if it's a header keyword
                    if (!getKeywords('category', ['대분류', '분류'], dbFields).includes(catStr)) {
                        lastCategory = catStr;
                    }
                }
            }

            // 4. Parse Values
            const currentStock = cleanNumber(qtyVal);

            const unitVal = row[unitIdx];
            const unit = unitVal ? String(unitVal).trim() : 'EA';

            const pkgUnit = colIdx.pkgUnit > -1 ? String(row[colIdx.pkgUnit] || '') : '';
            const pkgType = colIdx.pkgType > -1 ? String(row[colIdx.pkgType] || '') : '';
            const outerPkg = colIdx.outerPkg > -1 ? String(row[colIdx.outerPkg] || '') : '';

            items.push({
                id: `LEGACY-${Date.now()}-${i}`,
                lastUpdated: today,
                category: lastCategory,
                name: name,
                pkgUnit,
                pkgType,
                outerPkg,
                unit: unit,
                currentStock: currentStock,
                safeStock: 1, // Default to 1 (at least 1)
                location: '',
                supplier: '',
                note: ''
            });
        }

        return { success: true, items };

    } catch (e) {
        console.error("Legacy parsing error", e);
        return { success: false, items: [] };
    }
};

export const processFixedLegacyFormat = (data: any[][], headerRowIndex: number, dbFields: FieldDef[]): { success: boolean, items: InventoryItem[] } => {
    try {
        const headerRow = data[headerRowIndex];
        if (!headerRow) return { success: false, items: [] };
        const normalize = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();
        const findIndex = (keywords: string[]) =>
            headerRow.findIndex((cell) => keywords.some(k => normalize(cell).includes(normalize(k))));

        const colIdx = {
            category: findIndex(getKeywords('category', ['대분류'], dbFields)),
            name: findIndex(getKeywords('name', ['소분류', '품목명', '품명'], dbFields)),
            pkgUnit: findIndex(getKeywords('pkgUnit', ['포장단위'], dbFields)),
            pkgType: findIndex(getKeywords('pkgType', ['박스(묶음)구성', '박스구성'], dbFields)),
            outerPkg: findIndex(getKeywords('outerPkg', ['소포장개수', '소포장'], dbFields)),
            stock: findIndex(getKeywords('currentStock', ['잔량', '현재고', '재고', '기준재고'], dbFields)),
            unit: findIndex(getKeywords('unit', ['관리단위', '단위'], dbFields))
        };

        if (colIdx.name === -1 || colIdx.stock === -1) return { success: false, items: [] };
        const unitIdx = colIdx.unit > -1 ? colIdx.unit : colIdx.stock + 1;

        const items: InventoryItem[] = [];
        let lastCategory = '기타';
        const today = new Date().toISOString().split('T')[0];

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const nameRaw = row[colIdx.name];
            let name = nameRaw !== undefined && nameRaw !== null ? String(nameRaw).trim() : '';
            const cleanName = name.replace(/\s/g, '');

            if (getKeywords('name', ['소분류', '품목명', '품명'], dbFields).includes(cleanName)) continue;
            if (['소계', '합계', '총계', '계'].some(k => cleanName === k || cleanName.startsWith(k))) continue;

            const qtyVal = row[colIdx.stock];
            const hasStock = qtyVal !== undefined && qtyVal !== null && String(qtyVal).trim() !== '';
            if (!name && !hasStock) continue;
            if (!name) name = '품목명 미기재';

            const catRaw = row[colIdx.category];
            if (catRaw) {
                const catStr = String(catRaw).trim();
                if (!getKeywords('category', ['대분류', '분류'], dbFields).includes(catStr)) {
                    lastCategory = catStr;
                }
            }

            const currentStock = cleanNumber(qtyVal);
            const unitVal = row[unitIdx];
            const unit = unitVal ? String(unitVal).trim() : 'EA';
            const pkgUnit = String(row[colIdx.pkgUnit] || '');
            const pkgType = String(row[colIdx.pkgType] || '');
            const outerPkg = String(row[colIdx.outerPkg] || '');

            items.push({
                id: `LEGACY-${Date.now()}-${i}`,
                lastUpdated: today,
                category: lastCategory,
                name: name,
                pkgUnit,
                pkgType,
                outerPkg,
                unit: unit,
                currentStock: currentStock,
                safeStock: 1,
                location: '',
                supplier: '',
                note: ''
            });
        }

        return { success: true, items };
    } catch (e) {
        console.error("Legacy parsing error", e);
        return { success: false, items: [] };
    }
};

export const guessMapping = (headers: string[], dbFields: FieldDef[]): FieldMapping => {
    const newMapping: any = {};

    // Base keywords for robust matching.
    const targets: Record<string, string[]> = {
        category: ['대분류', 'Category'],
        name: ['소분류', '품목명', 'Sub-category', 'Item Name'],
        pkgUnit: ['포장단위', '낱개', 'In Box'],
        pkgType: ['박스구성', '묶음구성', 'Box contents', 'Bpx contents'],
        outerPkg: ['소포장', 'In contents'],
        currentStock: ['잔량', '현재고', '재고', '기준재고', 'Balance'],
        unit: ['단위', '관리단위', '관리 단위', 'Unit'],
        safeStock: ['적정재고', 'Safe Stock'],
        location: ['보관장소', '위치', 'Location'],
        supplier: ['거래처', '공급사', '사용부서', 'Supplier', 'Dept'],
        note: ['비고', '메모', 'Note', 'Remark']
    };

    // Add custom labels from settings to the matching keywords, prioritizing them.
    dbFields.forEach(field => {
        const coreLabel = field.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
        if (coreLabel && !targets[field.key].includes(coreLabel)) {
            targets[field.key].unshift(coreLabel); // Add to the front for higher priority
        }
    });

    // Perform the mapping
    headers.forEach(header => {
        if (!header) return;
        const h = header.replace(/\s/g, '').toLowerCase();

        for (const [fieldKey, keywords] of Object.entries(targets)) {
            // If already mapped, don't overwrite.
            if (!newMapping[fieldKey] && keywords.some(k => h.includes(k.replace(/\s/g, '').toLowerCase()))) {
                newMapping[fieldKey] = header;
            }
        }
    });

    // Resolve ambiguity for '단위' vs '포장단위'
    if (newMapping.unit && newMapping.unit === newMapping.pkgUnit) {
        if (newMapping.unit.includes('포장') || newMapping.unit.toLowerCase().includes('box')) {
            // Header is likely '포장단위', so it should not map to the general 'unit' field.
            delete newMapping.unit;
        } else {
            // Header is likely just '단위', so it should not map to 'pkgUnit'.
            delete newMapping.pkgUnit;
        }
    }

    return newMapping;
};
