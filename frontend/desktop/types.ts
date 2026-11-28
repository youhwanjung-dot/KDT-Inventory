export type TxPermission = 'ALL' | 'IN_ONLY' | 'OUT_ONLY';
export type UserRole = 'admin' | 'user';
export type UnitType = 'EA' | 'SET' | 'BOX' | string;

export interface ZoneAliasRecord {
  name: string;
  changedAt: string;
  customer?: string;
}

export interface ZoneMeta {
  zoneId: string;               // Immutable internal ZONE ID (e.g. Z001)
  displayName: string;          // Current display alias (e.g. ZONE18, Fluid18)
  customer?: string;            // Customer name
  plannedProductionQty?: number;// [Phase 2 pre-built] Target production qty (e.g. 9600)
  actualProductionQty?: number; // [Phase 2 pre-built] Actual production qty
  aliasHistory?: ZoneAliasRecord[];
}

export interface InventoryItem {
  id: string;
  name: string;                 // 품명 (소분류)
  category: string;             // ZONE 표시명 (대분류, Asan 호환)
  zoneId?: string;              // 불변 ZONE ID (별칭 변경 시 이력 유지)
  orderCategory?: number;
  orderName?: number;

  // KDT 확장 자재 식별/포장 필드
  plating?: string;             // 도금 (예: 3가, SUS)
  spec?: string;                // 규격 (예: M6*25, M8)
  unit: UnitType;               // 표시/공급 단위 (EA, SET, BOX)
  eaPerUnit?: number;           // 1단위당 EA 수량 (참고/환산용, 기본 1)

  // [2차 과제 선반영] 생산수량 연동 BOM 필드
  qtyPerProduct?: number;       // 완제품 1대당 소요량 (엑셀 1 SET 열)
  setGroup?: string;            // 소속 SET 그룹명 (예: 육각볼트 SET M6*25)

  // Asan 호환 레거시 포장 필드 (목업/임포트 하위 호환 유지)
  pkgUnit: string;
  pkgType: string;
  outerPkg: string;

  currentStock: number;         // 현재고 (정수 EA 단일 기준)
  safeStock: number;            // 적정재고 (EA)
  location: string;             // 보관위치 (랙/선반)
  supplier: string;             // 공급사/사용부서
  lastUpdated: string;          // 최종수정일 (YYYY-MM-DD)
  note?: string;                // 비고 (소포장 pkg 내역 등 참고용)
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  category: string;             // ZONE 표시명
  zoneId?: string;              // 불변 ZONE ID
  plating?: string;             // 품목 스냅샷: 도금
  spec?: string;                // 품목 스냅샷: 규격
  date: string;                 // YYYY-MM-DD
  type: 'IN' | 'OUT';           // 입고 | 출고
  quantity: number;             // 실수량 (정수 EA)
  worker: string;               // 작업자
  department: string;           // 작업부서
  reason: string;               // 비고 / 사유 (소포장 참고 등)
  currentStockSnapshot: number; // 거래 직후 재고 (EA)
}

export interface ZoneArchiveSummary {
  id: string;
  zoneId: string;
  displayName: string;
  status: 'ARCHIVED' | 'RESTORED';
  itemCount: number;
  transactionCount: number;
  orphanTransactionCount: number;
  archivedBy: string;
  archivedAt?: any;
}

export interface ZoneArchiveData extends ZoneArchiveSummary {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
}

export type ViewState = 'DASHBOARD' | 'INVENTORY' | 'ANALYSIS' | 'IMPORT' | 'HISTORY_IMPORT';

export interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  totalCategories: number;
}

export interface User {
  id: string;
  name: string;
  password: string;
  role: UserRole;
  txPermission?: TxPermission;  // ALL | IN_ONLY (입고전용) | OUT_ONLY (출고전용)
  department?: string;
  email?: string;
}

export interface MasterData {
  categories: string[];
  namesByCategory: Record<string, string[]>;
  nameOrder: string[];
  zoneMeta?: Record<string, ZoneMeta>; // key = zoneId or category
}

// Legacy enum kept solely for backward compatibility with imported helper modules
export enum Category {
  ZONE16_PLUS = 'ZONE16_Plus',
  ZONE18 = 'ZONE18',
  ETC = '기타',
}
