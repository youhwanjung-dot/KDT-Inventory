import { InventoryItem, InventoryTransaction } from './types';

type SeedItem = {
  id: string;
  category: 'ZONE16_Plus' | 'ZONE18';
  name: string;
  plating?: string;
  spec?: string;
  unit: string;
  qtyPerProduct: number;
  currentStock: number;
  lastUpdated: string;
  note?: string;
};

const seedItems: SeedItem[] = [
  { id: 'KDT-001', category: 'ZONE16_Plus', name: '클램프 (L)', unit: 'SET', qtyPerProduct: 1, currentStock: 1200, lastUpdated: '2026-11-17' },
  { id: 'KDT-002', category: 'ZONE16_Plus', name: '클램프 (R)', unit: 'SET', qtyPerProduct: 1, currentStock: 1200, lastUpdated: '2026-11-17' },
  { id: 'KDT-003', category: 'ZONE16_Plus', name: 'L 브라켓 가스켓', unit: 'SET(×2)', qtyPerProduct: 1, currentStock: 22000, lastUpdated: '2026-11-17', note: '11,000 set x 2pcs' },
  { id: 'KDT-004', category: 'ZONE16_Plus', name: 'I/O 스티커', unit: 'SET(×3)', qtyPerProduct: 1, currentStock: 33000, lastUpdated: '2026-11-17', note: '11,000 set x 3pcs' },
  { id: 'KDT-005', category: 'ZONE16_Plus', name: 'ABB PC 판', unit: 'EA', qtyPerProduct: 1, currentStock: 1920, lastUpdated: '2026-11-17' },
  { id: 'KDT-006', category: 'ZONE16_Plus', name: '절곡 부스바', unit: 'EA', qtyPerProduct: 1, currentStock: 1920, lastUpdated: '2026-11-18' },
  { id: 'KDT-007', category: 'ZONE16_Plus', name: '평 부스바', unit: 'EA', qtyPerProduct: 1, currentStock: 1920, lastUpdated: '2026-11-18' },
  { id: 'KDT-008', category: 'ZONE16_Plus', name: '드라이업', unit: 'BOX(×60)', qtyPerProduct: 1, currentStock: 300, lastUpdated: '2026-11-18', note: '60 x 5box' },
  { id: 'KDT-009', category: 'ZONE16_Plus', name: '강력방습제', unit: 'BOX(×400)', qtyPerProduct: 1, currentStock: 1600, lastUpdated: '2026-11-18', note: '400 x 4box' },
  { id: 'KDT-010', category: 'ZONE16_Plus', name: '샤프트 (ABB)', unit: 'EA', qtyPerProduct: 1, currentStock: 1900, lastUpdated: '2026-11-18' },

  { id: 'KDT-011', category: 'ZONE18', name: '육각볼트 [3가/M6*25]', plating: '3가', spec: 'M6*25', unit: 'EA', qtyPerProduct: 6, currentStock: 55000, lastUpdated: '2026-11-17' },
  { id: 'KDT-012', category: 'ZONE18', name: '육각너트 [3가/M6]', plating: '3가', spec: 'M6', unit: 'EA', qtyPerProduct: 6, currentStock: 110000, lastUpdated: '2026-11-17', note: 'PDF 수량란 110,000 EA; 별도 표기 Nut:55,000' },
  { id: 'KDT-013', category: 'ZONE18', name: '스프링 와셔 [3가/M6]', plating: '3가', spec: 'M6', unit: 'EA', qtyPerProduct: 6, currentStock: 55000, lastUpdated: '2026-11-17' },
  { id: 'KDT-014', category: 'ZONE18', name: '평와셔 [3가/M6]', plating: '3가', spec: 'M6', unit: 'EA', qtyPerProduct: 12, currentStock: 110000, lastUpdated: '2026-11-17' },
  { id: 'KDT-015', category: 'ZONE18', name: '육각볼트 [3가/M8*25]', plating: '3가', spec: 'M8*25', unit: 'EA', qtyPerProduct: 2, currentStock: 19000, lastUpdated: '2026-11-17' },
  { id: 'KDT-016', category: 'ZONE18', name: '육각너트 [3가/M8]', plating: '3가', spec: 'M8', unit: 'EA', qtyPerProduct: 2, currentStock: 19000, lastUpdated: '2026-11-17' },
  { id: 'KDT-017', category: 'ZONE18', name: '스프링 와셔 [3가/M8]', plating: '3가', spec: 'M8', unit: 'EA', qtyPerProduct: 2, currentStock: 19000, lastUpdated: '2026-11-17' },
  { id: 'KDT-018', category: 'ZONE18', name: '평와셔 [3가/M8]', plating: '3가', spec: 'M8', unit: 'EA', qtyPerProduct: 4, currentStock: 46100, lastUpdated: '2026-11-17', note: '구성품 37,000 + 단품 9,100 = 46,100 EA (PDF 비고 p/w:38,000 표기)' },
  { id: 'KDT-019', category: 'ZONE18', name: '육각볼트 [3가/M8*60]', plating: '3가', spec: 'M8*60', unit: 'EA', qtyPerProduct: 1, currentStock: 9100, lastUpdated: '2026-11-17', note: 'PDF 수량란 9,100 EA 적용; 비고 계산식은 8,200 EA' },
  { id: 'KDT-020', category: 'ZONE18', name: '육각쎔스볼트 [3가/M4*8]', plating: '3가', spec: 'M4*8', unit: 'EA', qtyPerProduct: 4, currentStock: 37000, lastUpdated: '2026-11-17' },
  { id: 'KDT-021', category: 'ZONE18', name: '육각쎔스볼트 [3가/M6*12]', plating: '3가', spec: 'M6*12', unit: 'EA', qtyPerProduct: 4, currentStock: 37000, lastUpdated: '2026-11-17', note: 'PDF 수량란 37,000 EA 적용; 비고 계산식은 32,000 EA' },
  { id: 'KDT-022', category: 'ZONE18', name: '육각쎔스볼트 [3가/M6*16]', plating: '3가', spec: 'M6*16', unit: 'EA', qtyPerProduct: 4, currentStock: 37000, lastUpdated: '2026-11-17' },
  { id: 'KDT-023', category: 'ZONE18', name: '육각쎔스볼트 [3가/M8*20]', plating: '3가', spec: 'M8*20', unit: 'EA', qtyPerProduct: 2, currentStock: 19000, lastUpdated: '2026-11-17' },
  { id: 'KDT-024', category: 'ZONE18', name: '접시머리볼트 [3가/M6*20]', plating: '3가', spec: 'M6*20', unit: 'EA', qtyPerProduct: 6, currentStock: 55000, lastUpdated: '2026-11-17' },
  { id: 'KDT-025', category: 'ZONE18', name: '트러스볼트 [3가/M4*8]', plating: '3가', spec: 'M4*8', unit: 'EA', qtyPerProduct: 6, currentStock: 55000, lastUpdated: '2026-11-17' },
  { id: 'KDT-026', category: 'ZONE18', name: '트러스볼트 [SUS/M5*10]', plating: 'SUS', spec: 'M5*10', unit: 'EA', qtyPerProduct: 4, currentStock: 37000, lastUpdated: '2026-11-17' },
  { id: 'KDT-027', category: 'ZONE18', name: '후렌지너트 [3가/M4]', plating: '3가', spec: 'M4', unit: 'EA', qtyPerProduct: 3, currentStock: 28000, lastUpdated: '2026-11-17' },
  { id: 'KDT-028', category: 'ZONE18', name: '후렌지너트 [3가/M6]', plating: '3가', spec: 'M6', unit: 'EA', qtyPerProduct: 7, currentStock: 64000, lastUpdated: '2026-11-17' },
  { id: 'KDT-029', category: 'ZONE18', name: '후렌지너트 [3가/M8]', plating: '3가', spec: 'M8', unit: 'EA', qtyPerProduct: 2, currentStock: 19000, lastUpdated: '2026-11-17' },
  { id: 'KDT-030', category: 'ZONE18', name: '육각쎔스볼트(UPSET) [3가/M6*16]', plating: '3가', spec: 'M6*16', unit: 'EA', qtyPerProduct: 6, currentStock: 55000, lastUpdated: '2026-11-17' },
  { id: 'KDT-031', category: 'ZONE18', name: '절곡 부스바', unit: 'EA', qtyPerProduct: 1, currentStock: 2080, lastUpdated: '2026-11-18' },
  { id: 'KDT-032', category: 'ZONE18', name: '평 부스바', unit: 'EA', qtyPerProduct: 1, currentStock: 2080, lastUpdated: '2026-11-18' },
];

export const PDF_VERIFIED_INVENTORY: InventoryItem[] = seedItems.map((item) => ({
  ...item,
  zoneId: item.category,
  plating: item.plating ?? '',
  spec: item.spec ?? '',
  eaPerUnit: 1,
  setGroup: '',
  safeStock: 0,
  location: '',
  supplier: '',
  pkgUnit: '',
  pkgType: item.unit,
  outerPkg: '',
  note: item.note ?? '',
}));

type ReceiptRow = {
  itemId: string;
  date: string;
  quantity: number;
  currentStockSnapshot: number;
  reason: string;
};

const receiptRows: ReceiptRow[] = [
  { itemId: 'KDT-001', date: '2026-11-17', quantity: 1200, currentStockSnapshot: 1200, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-002', date: '2026-11-17', quantity: 1200, currentStockSnapshot: 1200, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-003', date: '2026-11-17', quantity: 22000, currentStockSnapshot: 22000, reason: '11,000 SET x 2 EA' },
  { itemId: 'KDT-004', date: '2026-11-17', quantity: 33000, currentStockSnapshot: 33000, reason: '11,000 SET x 3 EA' },
  { itemId: 'KDT-005', date: '2026-11-17', quantity: 1920, currentStockSnapshot: 1920, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-006', date: '2026-11-18', quantity: 1920, currentStockSnapshot: 1920, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-007', date: '2026-11-18', quantity: 1920, currentStockSnapshot: 1920, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-008', date: '2026-11-18', quantity: 300, currentStockSnapshot: 300, reason: '60 EA x 5 BOX' },
  { itemId: 'KDT-009', date: '2026-11-18', quantity: 1600, currentStockSnapshot: 1600, reason: '400 EA x 4 BOX' },
  { itemId: 'KDT-010', date: '2026-11-18', quantity: 1900, currentStockSnapshot: 1900, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-011', date: '2026-11-17', quantity: 55000, currentStockSnapshot: 55000, reason: 'PDF 수량란 55,000 EA' },
  { itemId: 'KDT-012', date: '2026-11-17', quantity: 110000, currentStockSnapshot: 110000, reason: 'PDF 수량란 110,000 EA' },
  { itemId: 'KDT-013', date: '2026-11-17', quantity: 55000, currentStockSnapshot: 55000, reason: 'PDF 수량란 55,000 EA' },
  { itemId: 'KDT-014', date: '2026-11-17', quantity: 110000, currentStockSnapshot: 110000, reason: 'PDF 수량란 110,000 EA' },
  { itemId: 'KDT-015', date: '2026-11-17', quantity: 19000, currentStockSnapshot: 19000, reason: 'PDF 수량란 19,000 EA' },
  { itemId: 'KDT-016', date: '2026-11-17', quantity: 19000, currentStockSnapshot: 19000, reason: 'PDF 수량란 19,000 EA' },
  { itemId: 'KDT-017', date: '2026-11-17', quantity: 19000, currentStockSnapshot: 19000, reason: 'PDF 수량란 19,000 EA' },
  { itemId: 'KDT-018', date: '2026-11-17', quantity: 37000, currentStockSnapshot: 37000, reason: 'M8*25 SET 구성품 수량란 37,000 EA' },
  { itemId: 'KDT-019', date: '2026-11-17', quantity: 9100, currentStockSnapshot: 9100, reason: 'PDF 수량란 9,100 EA (비고 계산식 불일치)' },
  { itemId: 'KDT-020', date: '2026-11-17', quantity: 37000, currentStockSnapshot: 37000, reason: 'PDF 수량란 37,000 EA' },
  { itemId: 'KDT-021', date: '2026-11-17', quantity: 37000, currentStockSnapshot: 37000, reason: 'PDF 수량란 37,000 EA (비고 계산식 불일치)' },
  { itemId: 'KDT-022', date: '2026-11-17', quantity: 37000, currentStockSnapshot: 37000, reason: 'PDF 수량란 37,000 EA' },
  { itemId: 'KDT-023', date: '2026-11-17', quantity: 19000, currentStockSnapshot: 19000, reason: 'PDF 수량란 19,000 EA' },
  { itemId: 'KDT-024', date: '2026-11-17', quantity: 55000, currentStockSnapshot: 55000, reason: 'PDF 수량란 55,000 EA' },
  { itemId: 'KDT-025', date: '2026-11-17', quantity: 55000, currentStockSnapshot: 55000, reason: 'PDF 수량란 55,000 EA' },
  { itemId: 'KDT-026', date: '2026-11-17', quantity: 37000, currentStockSnapshot: 37000, reason: 'PDF 수량란 37,000 EA' },
  { itemId: 'KDT-027', date: '2026-11-17', quantity: 28000, currentStockSnapshot: 28000, reason: 'PDF 수량란 28,000 EA' },
  { itemId: 'KDT-028', date: '2026-11-17', quantity: 64000, currentStockSnapshot: 64000, reason: 'PDF 수량란 64,000 EA' },
  { itemId: 'KDT-029', date: '2026-11-17', quantity: 19000, currentStockSnapshot: 19000, reason: 'PDF 수량란 19,000 EA' },
  { itemId: 'KDT-030', date: '2026-11-17', quantity: 55000, currentStockSnapshot: 55000, reason: 'PDF 수량란 55,000 EA' },
  { itemId: 'KDT-018', date: '2026-11-17', quantity: 9100, currentStockSnapshot: 46100, reason: 'M8 단품 입고 수량란 9,100 EA' },
  { itemId: 'KDT-031', date: '2026-11-18', quantity: 2080, currentStockSnapshot: 2080, reason: 'PDF 입고 수량' },
  { itemId: 'KDT-032', date: '2026-11-18', quantity: 2080, currentStockSnapshot: 2080, reason: 'PDF 입고 수량' },
];

const itemsById = new Map(PDF_VERIFIED_INVENTORY.map((item) => [item.id, item]));

export const PDF_VERIFIED_TRANSACTIONS: InventoryTransaction[] = receiptRows.map((row, index) => {
  const item = itemsById.get(row.itemId)!;
  return {
    ...row,
    id: `TX-INIT-${String(index + 1).padStart(3, '0')}`,
    itemName: item.name,
    category: item.category,
    zoneId: item.zoneId,
    plating: item.plating,
    spec: item.spec,
    type: 'IN',
    worker: '',
    department: '',
  };
});
