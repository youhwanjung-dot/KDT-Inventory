import { InventoryItem, User, InventoryTransaction } from './types';
import { initialData } from './initialData';
import { INITIAL_TRANSACTIONS as initialTxData } from './initialTransactions';

declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __MOCKUP_MODE__: boolean;
declare const __STORAGE_MODE__: 'Cloud' | 'Local';

export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_TIMESTAMP: string = __BUILD_TIMESTAMP__;
export const MOCKUP_MODE: boolean = typeof __MOCKUP_MODE__ !== 'undefined' ? __MOCKUP_MODE__ : false;
export const STORAGE_MODE: 'Cloud' | 'Local' = typeof __STORAGE_MODE__ !== 'undefined' ? __STORAGE_MODE__ : 'Cloud';

export const INITIAL_INVENTORY: InventoryItem[] = initialData;
export const INITIAL_TRANSACTIONS: InventoryTransaction[] = initialTxData;

// KDT Default Users (Q11 + C3 confirmed)
export const INITIAL_USERS: User[] = [
  { id: 'admin', name: '관리자',      password: '6922', role: 'admin', txPermission: 'ALL',      email: 'youhwanjung@gmail.com' },
  { id: 'ksh',   name: '김수현 팀장', password: '1234', role: 'user',  txPermission: 'IN_ONLY'  },
  { id: 'hhd',   name: '황호동 반장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'mjw',   name: '문자운 조장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'kmk',   name: '김민기 조장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'lhj',   name: '이호준 계장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
];

export const FIELD_SETTINGS_KEY = 'kdt_field_settings_v1.0';
export const EVENT_FIELD_SETTINGS_CHANGED = 'kdt_field_settings_changed';
export const MASTER_DATA_KEY = 'kdt_master_data_v1.0';
export const SESSION_USER_KEY = 'kdt_active_user';
export const SESSION_VIEW_KEY = 'kdt_active_view';
export const APP_VERSION_STORAGE_KEY = 'kdt_app_version';
export const COL_WIDTHS_STORAGE_KEY = 'kdt_inventory_col_widths_v1';

export interface FieldDef {
  key: keyof Omit<InventoryItem, 'id' | 'lastUpdated'>;
  label: string;
  required: boolean;
}

export const DEFAULT_DB_FIELDS: FieldDef[] = [
  { key: 'category',      label: 'ZONE(대분류)',  required: true  },
  { key: 'name',          label: '품명',          required: true  },
  { key: 'plating',       label: '도금',          required: false },
  { key: 'spec',          label: '규격',          required: false },
  { key: 'unit',          label: '표시단위',      required: true  },
  { key: 'eaPerUnit',     label: '단위당 EA',     required: false },
  { key: 'qtyPerProduct', label: '1대당 소요',    required: false },
  { key: 'currentStock',  label: '현재고(EA)',    required: true  },
  { key: 'safeStock',     label: '적정재고',      required: false },
  { key: 'location',      label: '보관위치',      required: false },
  { key: 'note',          label: '비고',          required: false },
];
