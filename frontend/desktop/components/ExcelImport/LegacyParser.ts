import { InventoryItem } from '../../types';
import { FieldDef } from '../../constants';
import { getKeywords, cleanNumber, FieldMapping } from './utils';

const COMP_NAME_MAP: Record<string, string> = {
    '볼트': '육각볼트',
    '너트': '육각너트',
    '스프링 와셔': '스프링 와셔',
    '스프링와셔': '스프링 와셔',
    '평와셔': '평와셔'
};

const parseRealQtyFromNote = (note: string, fallback: number): number => {
    if (!note) return Math.round(fallback || 0);
    const m = String(note).match(/=\s*([\d,]+)\s*ea/i);
    if (m && m[1]) {
        return parseInt(m[1].replace(/,/g, ''), 10) || Math.round(fallback || 0);
    }
    return Math.round(fallback || 0);
};

const toIsoDate = (val: any, fallback: string): string => {
    if (!val && val !== 0) return fallback;
    if (typeof val === 'number' && val > 20000 && val < 90000) {
        // Excel serial date
        const utcDays = Math.floor(val - 25569);
        const d = new Date(utcDays * 86400 * 1000);
        return d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return fallback;
};

/**
 * KDT INBOUND SHEET PARSER (`ZONE16_Plus_Inbound`, `ZONE18_Inbound`)
 * Columns: [No | 입고일 | 품명 | 도금 | 규격 | 단위 | 1 SET | 수량(EA) | 비고]
 * Handles parent `육각볼트 SET` rows + `ㅁ 볼트/너트/스프링 와셔/평와셔` child rows,
 * real inspected quantities in note (`=8200ea`), and duplicate item merging (e.g., ZONE18 M8 flat washer 37,000 + 9,100 = 46,100 EA).
 */
export const processKdtInboundSheet = (
    data: any[][],
    sheetName: string
): { success: boolean; items: InventoryItem[] } => {
    try {
        const normalize = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();
        const zoneName = String(sheetName || '').replace(/_inbound$/i, '').trim() || 'ZONE';

        // Locate header row containing '품명' and ('도금' or '규격')
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, data.length); i++) {
            const row = data[i];
            if (!row) continue;
            const normRow = row.map(normalize);
            const hasName = normRow.some(c => c.includes('품명') || c.includes('품목명'));
            const hasPlatingOrSpec = normRow.some(c => c.includes('도금') || c.includes('규격'));
            if (hasName && hasPlatingOrSpec) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1) return { success: false, items: [] };

        const header = data[headerRowIdx].map(normalize);
        const hasDateColumn = header.some((c) =>
            ['입고일', '일자', 'date'].some((key) => c.includes(normalize(key)))
        );
        const hasInboundQuantityColumn = header.some((c) => c.includes('수량'));
        // The Main inventory summary has 품명/도금/현재고 too, but is not an inbound sheet.
        if (!hasDateColumn || !hasInboundQuantityColumn) return { success: false, items: [] };

        const findCol = (keys: string[], fallback: number) => {
            const idx = header.findIndex(c => keys.some(k => c.includes(k)));
            return idx !== -1 ? idx : fallback;
        };

        const dateCol = findCol(['입고일', '일자', 'date'], 1);
        const nameCol = findCol(['품명', '품목명'], 2);
        const platingCol = findCol(['도금'], 3);
        const specCol = findCol(['규격'], 4);
        const unitCol = findCol(['단위'], 5);
        const qppCol = findCol(['1set', 'set', '소요량'], 6);
        const qtyCol = findCol(['수량', '현재고', '재고'], 7);
        const noteCol = findCol(['비고', 'note'], 8);

        const today = new Date().toISOString().slice(0, 10);
        let curDate = today;
        let curSetGroup = '';
        let curSetPlating = '';
        let curSetSpec = '';
        let curSetQpp = 1;

        const mergedMap = new Map<string, InventoryItem>();

        const upsertItem = (
            date: string,
            name: string,
            plating: string,
            spec: string,
            unit: string,
            eaPerUnit: number,
            qtyPerProduct: number,
            realQty: number,
            note: string,
            setGroup: string
        ) => {
            const key = `${zoneName}|${name}|${plating}|${spec}`.toLowerCase();
            const existing = mergedMap.get(key);
            if (!existing) {
                mergedMap.set(key, {
                    id: `KDT-IMP-${Date.now()}-${mergedMap.size + 1}`,
                    category: zoneName,
                    zoneId: zoneName,
                    name,
                    plating,
                    spec,
                    unit: unit || 'EA',
                    eaPerUnit: eaPerUnit || 1,
                    qtyPerProduct: qtyPerProduct || 1,
                    setGroup,
                    currentStock: Math.round(realQty),
                    safeStock: 0,
                    location: '',
                    supplier: '',
                    pkgUnit: eaPerUnit > 1 ? String(eaPerUnit) : '',
                    pkgType: unit || 'EA',
                    outerPkg: '',
                    note,
                    lastUpdated: date
                });
            } else {
                existing.currentStock = Math.round((existing.currentStock || 0) + realQty);
                const existingNote = existing.note ?? '';
                if (note && !existingNote.includes(note)) {
                    existing.note = [existingNote, note].filter(Boolean).join(' / ');
                }
                if (date > existing.lastUpdated) {
                    existing.lastUpdated = date;
                }
            }
        };

        for (let r = headerRowIdx + 1; r < data.length; r++) {
            const row = data[r];
            if (!row || row.length === 0) continue;
            const rawName = String(row[nameCol] ?? '').trim();
            if (!rawName) continue;

            const d = toIsoDate(row[dateCol], '');
            if (d) curDate = d;

            const plating = String(row[platingCol] ?? '').trim();
            const spec = String(row[specCol] ?? '').trim();
            const unit = String(row[unitCol] ?? '').trim() || 'EA';
            const gVal = cleanNumber(row[qppCol]);
            const hVal = cleanNumber(row[qtyCol]);
            const note = String(row[noteCol] ?? '').trim();

            // 1. Parent SET header row (e.g., 육각볼트 SET) -> record context for child rows, skip stock item (Q7-1)
            if (rawName.toUpperCase().includes('SET') && unit.toUpperCase() === 'SET' && data[r + 1] && String(data[r + 1][nameCol] ?? '').trim().startsWith('ㅁ')) {
                curSetGroup = `${rawName} ${spec}`.trim();
                curSetPlating = plating;
                curSetSpec = spec;
                curSetQpp = gVal > 0 ? Math.round(gVal) : 1;
                continue;
            }

            // 2. Child component row starting with 'ㅁ'
            if (rawName.startsWith('ㅁ')) {
                const compRaw = rawName.replace(/^ㅁ\s*/, '').trim();
                const compName = COMP_NAME_MAP[compRaw] || compRaw;
                const diam = curSetSpec.includes('*') ? curSetSpec.split('*')[0] : curSetSpec;
                const compSpec = compRaw === '볼트' ? curSetSpec : diam;
                const realQty = Math.round(hVal || 0);
                const pkgNote = note ? `${spec} (${note})`.trim() : spec;
                const qpp = curSetQpp * (compRaw === '평와셔' && note.includes('2') ? 2 : 1);
                upsertItem(curDate, compName, curSetPlating, compSpec, 'EA', 1, qpp, realQty, pkgNote, curSetGroup);
                continue;
            }

            // 3. Standard item row
            curSetGroup = '';
            const realQty = parseRealQtyFromNote(note, hVal);
            let eaPerUnit = 1;
            let qtyPerProd = gVal > 0 ? Math.round(gVal) : 1;
            if ((unit.toUpperCase() === 'SET' || unit.toUpperCase() === 'BOX') && gVal >= 1 && realQty > 0 && realQty % Math.round(gVal) === 0) {
                const ratio = Math.round(realQty / Math.round(gVal));
                if (ratio > 1 && ratio <= 1000) {
                    eaPerUnit = ratio;
                    qtyPerProd = unit.toUpperCase() === 'SET' ? ratio : 1;
                }
            }
            upsertItem(curDate, rawName, plating, spec, unit.toUpperCase(), eaPerUnit, qtyPerProd, realQty, note, '');
        }

        const items = Array.from(mergedMap.values());
        return { success: items.length > 0, items };
    } catch (e) {
        console.error('KDT Inbound sheet parsing error', e);
        return { success: false, items: [] };
    }
};

/**
 * LEGACY & KDT MAIN SHEET PARSER
 * Handles both:
 * - KDT MAIN sheet: [연번 | ZONE(대분류) | 품명 | 도금 | 규격 | 단위/환산 | 현재고(EA) | 보관위치 | 1대당소요 | 비고]
 * - Legacy sheet:   [연번 | 대분류 | 소분류 | 포장단위 | 박스구성 | 소포장 | 잔량(Qty) | 잔량(Unit)]
 */
export const processLegacyFormat = (data: any[][], headerRowIndex: number, dbFields: FieldDef[]): { success: boolean, items: InventoryItem[] } => {
    return processFixedLegacyFormat(data, headerRowIndex, dbFields);
};

export const processFixedLegacyFormat = (data: any[][], headerRowIndex: number, dbFields: FieldDef[]): { success: boolean, items: InventoryItem[] } => {
    try {
        const headerRow = data[headerRowIndex];
        if (!headerRow) return { success: false, items: [] };
        const normalize = (s: any) => String(s || '').replace(/\s/g, '').toLowerCase();
        const findIndex = (keywords: string[]) =>
            headerRow.findIndex((cell) => keywords.some(k => normalize(cell).includes(normalize(k))));

        const colIdx = {
            category: findIndex(getKeywords('category', ['zone', '대분류'], dbFields)),
            name: findIndex(getKeywords('name', ['품명', '소분류', '품목명'], dbFields)),
            plating: findIndex(['도금', 'plating']),
            spec: findIndex(['규격', '사양', 'spec']),
            pkgUnit: findIndex(getKeywords('pkgUnit', ['포장단위'], dbFields)),
            pkgType: findIndex(getKeywords('pkgType', ['박스(묶음)구성', '박스구성'], dbFields)),
            outerPkg: findIndex(getKeywords('outerPkg', ['소포장개수', '소포장'], dbFields)),
            stock: findIndex(getKeywords('currentStock', ['현재고', '잔량', '재고', '기준재고', '수량'], dbFields)),
            unit: findIndex(getKeywords('unit', ['단위/환산', '관리단위', '단위'], dbFields)),
            location: findIndex(['보관위치', '보관장소', 'location']),
            qtyPerProduct: findIndex(['1대당소요', '1set', '소요량']),
            note: findIndex(['비고', 'note', '메모'])
        };

        if (colIdx.name === -1 || colIdx.stock === -1) return { success: false, items: [] };
        const unitIdx = colIdx.unit > -1 ? colIdx.unit : colIdx.stock + 1;

        const items: InventoryItem[] = [];
        let lastCategory = 'ZONE16_Plus';
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

            if (colIdx.category > -1) {
                const catRaw = row[colIdx.category];
                if (catRaw) {
                    const catStr = String(catRaw).trim();
                    if (!getKeywords('category', ['zone', '대분류', '분류'], dbFields).includes(catStr.toLowerCase())) {
                        lastCategory = catStr;
                    }
                }
            }

            const currentStock = Math.round(cleanNumber(qtyVal));
            const rawUnit = String(row[unitIdx] || 'EA').trim();
            let unit = 'EA';
            let eaPerUnit = 1;
            const unitMatch = rawUnit.match(/^(EA|SET|BOX)(?:\s*\(1\w+=(\d+)EA\))?/i);
            if (unitMatch) {
                unit = unitMatch[1].toUpperCase();
                if (unitMatch[2]) eaPerUnit = parseInt(unitMatch[2], 10) || 1;
            }

            const plating = colIdx.plating > -1 ? String(row[colIdx.plating] || '').trim() : '';
            const spec = colIdx.spec > -1 ? String(row[colIdx.spec] || '').trim() : '';
            const location = colIdx.location > -1 ? String(row[colIdx.location] || '').trim() : '';
            const note = colIdx.note > -1 ? String(row[colIdx.note] || '').trim() : '';
            const qtyPerProduct = colIdx.qtyPerProduct > -1 ? Math.round(cleanNumber(row[colIdx.qtyPerProduct])) || 1 : 1;

            items.push({
                id: `LEGACY-${Date.now()}-${i}`,
                lastUpdated: today,
                category: lastCategory,
                zoneId: lastCategory,
                name,
                plating,
                spec,
                pkgUnit: eaPerUnit > 1 ? String(eaPerUnit) : String(row[colIdx.pkgUnit] || ''),
                pkgType: unit,
                outerPkg: String(row[colIdx.outerPkg] || ''),
                unit,
                eaPerUnit,
                qtyPerProduct,
                currentStock,
                safeStock: 0,
                location,
                supplier: '',
                note
            });
        }

        return { success: true, items };
    } catch (e) {
        console.error('Legacy parsing error', e);
        return { success: false, items: [] };
    }
};

export const guessMapping = (headers: string[], dbFields: FieldDef[]): FieldMapping => {
    const newMapping: any = {};

    const targets: Record<string, string[]> = {
        category: ['ZONE', '대분류', 'Category'],
        name: ['품명', '소분류', '품목명', 'Sub-category', 'Item Name'],
        plating: ['도금', '표면처리', 'Plating'],
        spec: ['규격', '사양', 'Spec'],
        pkgUnit: ['단위당EA', '포장단위', '낱개', 'In Box'],
        pkgType: ['박스구성', '묶음구성', 'Box contents'],
        outerPkg: ['소포장', 'In contents'],
        currentStock: ['현재고', '수량', '잔량', '재고', '기준재고', 'Balance'],
        unit: ['단위', '관리단위', '관리 단위', 'Unit'],
        safeStock: ['적정재고', '안전재고', 'Safe Stock'],
        location: ['보관위치', '보관장소', '위치', 'Location'],
        supplier: ['거래처', '공급사', '사용부서', 'Supplier', 'Dept'],
        note: ['비고', '메모', 'Note', 'Remark']
    };

    dbFields.forEach(field => {
        const coreLabel = field.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
        if (coreLabel && targets[field.key] && !targets[field.key].includes(coreLabel)) {
            targets[field.key].unshift(coreLabel);
        }
    });

    headers.forEach(header => {
        if (!header) return;
        const h = header.replace(/\s/g, '').toLowerCase();

        for (const [fieldKey, keywords] of Object.entries(targets)) {
            if (!newMapping[fieldKey] && keywords.some(k => h.includes(k.replace(/\s/g, '').toLowerCase()))) {
                newMapping[fieldKey] = header;
            }
        }
    });

    if (newMapping.unit && newMapping.unit === newMapping.pkgUnit) {
        if (newMapping.unit.includes('포장') || newMapping.unit.toLowerCase().includes('box')) {
            delete newMapping.unit;
        } else {
            delete newMapping.pkgUnit;
        }
    }

    return newMapping;
};
