import { utils } from 'xlsx';
import { InventoryItem } from '../../types';
import { FieldDef } from '../../constants';

// Internal type for mapping state
export type FieldMapping = {
    [key in keyof Omit<InventoryItem, 'id' | 'lastUpdated'>]: string;
};

export const cleanNumber = (val: any): number => {
    if (typeof val === 'number') return Math.round(val * 10) / 10;
    if (!val) return 0;
    const strVal = String(val).replace(/,/g, '').trim();
    const num = parseFloat(strVal);
    return isNaN(num) ? 0 : Math.round(num * 10) / 10;
};

/**
 * Resolve Merged Cells
 * Populates all cells in a merge range with the value of the top-left cell.
 */
export const resolveMergedCells = (ws: any) => {
    if (!ws['!merges']) return;

    ws['!merges'].forEach((merge: any) => {
        const startRef = utils.encode_cell(merge.s);
        const startCell = ws[startRef];

        if (startCell) {
            for (let r = merge.s.r; r <= merge.e.r; r++) {
                for (let c = merge.s.c; c <= merge.e.c; c++) {
                    const targetRef = utils.encode_cell({ c, r });
                    // If the cell is empty/undefined, clone the start cell value
                    if (!ws[targetRef]) {
                        ws[targetRef] = { ...startCell };
                    }
                }
            }
        }
    });

    // Remove merges metadata to treat them as individual cells
    delete ws['!merges'];
};

export const resolveFormulaRefs = (wb: any, ws: any) => {
    const getFormula = (cell: any) => {
        if (cell && cell.f) return cell.f;
        if (typeof cell?.v === 'string' && cell.v.startsWith('=')) return cell.v.slice(1);
        return null;
    };

    const parseRef = (formula: string) => {
        const match = formula.match(/^'?(.*?)'?!\$?([A-Z]+)\$?(\d+)$/);
        if (!match) return null;
        const sheetName = match[1];
        const ref = `${match[2]}${match[3]}`;
        return { sheetName, ref };
    };

    const resolveValue = (formula: string, depth: number): any => {
        const parsed = parseRef(formula);
        if (!parsed) return null;
        const targetSheet = wb.Sheets?.[parsed.sheetName];
        if (!targetSheet) return null;
        const targetCell = targetSheet[parsed.ref];
        if (!targetCell) return null;
        if (targetCell.v !== undefined && targetCell.v !== null && String(targetCell.v).trim() !== '') return targetCell.v;
        const nextFormula = depth < 1 ? getFormula(targetCell) : null;
        if (nextFormula) {
            const nested = resolveValue(nextFormula, depth + 1);
            if (nested !== null && nested !== undefined && String(nested).trim() !== '') return nested;
        }
        if (targetCell.w !== undefined && targetCell.w !== null && String(targetCell.w).trim() !== '') return targetCell.w;
        return null;
    };

    Object.keys(ws).forEach((addr) => {
        if (addr.startsWith('!')) return;
        const cell = ws[addr];
        if (!cell) return;
        if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '' && !(typeof cell.v === 'string' && cell.v.trim().startsWith('='))) return;
        const formula = getFormula(cell);
        if (!formula) return;
        const resolved = resolveValue(formula, 0);
        if (resolved !== null && resolved !== undefined && String(resolved).trim() !== '') {
            cell.v = resolved;
        }
    });
};

// Helper function to get keywords for a field key, including custom labels
export const getKeywords = (key: string, defaultKeywords: string[], dbFields: FieldDef[]): string[] => {
    const field = dbFields.find(f => f.key === key);
    if (field) {
        const customLabel = field.label.replace(/^\d+\.\s*/, '').replace(/\(.*\)/, '').trim();
        // Return custom label prioritized, then defaults, remove duplicates
        return Array.from(new Set([customLabel, ...defaultKeywords]));
    }
    return defaultKeywords;
};
