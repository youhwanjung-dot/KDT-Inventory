/**
 * useAppState.ts — Ver5.3.0 리팩토링
 * 전체 앱 전역 State (useState) 및 유틸 함수 모음
 * 기존 index.tsx 에서 분리
 */
import { useState, useEffect, useRef } from 'react';
import { InventoryItem, InventoryTransaction, User, ViewState, MasterData } from '../types';
import { INITIAL_USERS, SESSION_USER_KEY, SESSION_VIEW_KEY } from '../constants';
import { roundToInt } from '../utils/formatters';

// ─── 유틸 함수 ──────────────────────────────────────────────────────────────

export const normalizeDateString = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return value;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return !isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString().slice(0, 10);
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return '';
};

export const isCarryOverReason = (reason?: string | null): boolean =>
  reason === '재고이월';

export const normalizeInventoryItem = (item: InventoryItem): InventoryItem => ({
  ...item,
  zoneId: item.zoneId || item.category || '',
  plating: item.plating ?? '',
  spec: item.spec ?? '',
  unit: item.unit || 'EA',
  eaPerUnit: Math.max(1, roundToInt(item.eaPerUnit ?? 1, 1)),
  qtyPerProduct: item.qtyPerProduct !== undefined ? Number(item.qtyPerProduct) || 0 : 0,
  setGroup: item.setGroup ?? '',
  currentStock: roundToInt(item.currentStock),
  safeStock: roundToInt(item.safeStock),
  orderCategory:
    item.orderCategory === undefined || item.orderCategory === null
      ? undefined
      : Number(item.orderCategory),
  orderName:
    item.orderName === undefined || item.orderName === null
      ? undefined
      : Number(item.orderName),
  pkgUnit: item.pkgUnit ?? '',
  pkgType: item.pkgType ?? '',
  outerPkg: item.outerPkg ?? '',
  lastUpdated: item.lastUpdated
    ? normalizeDateString(item.lastUpdated)
    : item.lastUpdated,
});

export const normalizeTransaction = (tx: InventoryTransaction): InventoryTransaction => ({
  ...tx,
  date: normalizeDateString(tx.date),
  quantity: roundToInt(tx.quantity),
  currentStockSnapshot: roundToInt(tx.currentStockSnapshot),
});

export const normalizeInventory = (items: InventoryItem[]): InventoryItem[] =>
  items.map(normalizeInventoryItem);

export const normalizeTransactions = (txs: InventoryTransaction[]): InventoryTransaction[] =>
  txs.map(normalizeTransaction);

// ─── State Hook ──────────────────────────────────────────────────────────────

export interface AppState {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;

  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;

  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;

  transactions: InventoryTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<InventoryTransaction[]>>;

  masterData: MasterData;
  setMasterData: React.Dispatch<React.SetStateAction<MasterData>>;

  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;

  currentView: ViewState;
  setCurrentView: React.Dispatch<React.SetStateAction<ViewState>>;

  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;

  showStockForm: boolean;
  setShowStockForm: React.Dispatch<React.SetStateAction<boolean>>;

  editingItem: InventoryItem | undefined;
  setEditingItem: React.Dispatch<React.SetStateAction<InventoryItem | undefined>>;

  showTransactionModal: boolean;
  setShowTransactionModal: React.Dispatch<React.SetStateAction<boolean>>;

  transactionItem: InventoryItem | null;
  setTransactionItem: React.Dispatch<React.SetStateAction<InventoryItem | null>>;

  showDBManager: boolean;
  setShowDBManager: React.Dispatch<React.SetStateAction<boolean>>;

  showUserManager: boolean;
  setShowUserManager: React.Dispatch<React.SetStateAction<boolean>>;

  showMasterDataManager: boolean;
  setShowMasterDataManager: React.Dispatch<React.SetStateAction<boolean>>;

  showDuplicateItemManager: boolean;
  setShowDuplicateItemManager: React.Dispatch<React.SetStateAction<boolean>>;

  showMonthlyReport: boolean;
  setShowMonthlyReport: React.Dispatch<React.SetStateAction<boolean>>;

  showMonthlyUsageReport: boolean;
  setShowMonthlyUsageReport: React.Dispatch<React.SetStateAction<boolean>>;

  showLogoutConfirm: boolean;
  setShowLogoutConfirm: React.Dispatch<React.SetStateAction<boolean>>;

  showManual: boolean;
  setShowManual: React.Dispatch<React.SetStateAction<boolean>>;

  showSuccessModal: boolean;
  setShowSuccessModal: React.Dispatch<React.SetStateAction<boolean>>;

  successMessage: string;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string>>;

  alertModal: { title: string; message: React.ReactNode; isDangerous?: boolean } | null;
  setAlertModal: React.Dispatch<
    React.SetStateAction<{ title: string; message: React.ReactNode; isDangerous?: boolean } | null>
  >;

  confirmModal: {
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  } | null;
  setConfirmModal: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: React.ReactNode;
      confirmLabel?: string;
      cancelLabel?: string;
      isDangerous?: boolean;
      onConfirm: () => void;
    } | null>
  >;

  progressModal: { title: string; message: React.ReactNode } | null;
  setProgressModal: React.Dispatch<
    React.SetStateAction<{ title: string; message: React.ReactNode } | null>
  >;

  // Migration 진행 중 onSnapshot 리스너가 로컬 상태를 덮어쓰지 않도록 억제하는 플래그
  realtimePausedRef: React.MutableRefObject<boolean>;
}

export function useAppState(): AppState {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [masterData, setMasterData] = useState<MasterData>({
    categories: [],
    namesByCategory: {},
    nameOrder: [],
    zoneMeta: {},
  });
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);

  const [currentView, setCurrentViewRaw] = useState<ViewState>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_VIEW_KEY);
      if (saved && ['DASHBOARD', 'INVENTORY', 'ANALYSIS', 'IMPORT', 'HISTORY_IMPORT'].includes(saved)) {
        return saved as ViewState;
      }
    } catch {}
    return 'DASHBOARD';
  });

  const setCurrentView: React.Dispatch<React.SetStateAction<ViewState>> = (viewOrUpdater) => {
    setCurrentViewRaw((prev) => {
      const next = typeof viewOrUpdater === 'function' ? (viewOrUpdater as any)(prev) : viewOrUpdater;
      try {
        sessionStorage.setItem(SESSION_VIEW_KEY, next);
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (user) {
      try {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      } catch {}
    } else {
      try {
        sessionStorage.removeItem(SESSION_USER_KEY);
        sessionStorage.removeItem(SESSION_VIEW_KEY);
      } catch {}
    }
  }, [user]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modals
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionItem, setTransactionItem] = useState<InventoryItem | null>(null);

  const [showDBManager, setShowDBManager] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showMasterDataManager, setShowMasterDataManager] = useState(false);
  const [showDuplicateItemManager, setShowDuplicateItemManager] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showMonthlyUsageReport, setShowMonthlyUsageReport] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: React.ReactNode;
    isDangerous?: boolean;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [progressModal, setProgressModal] = useState<{
    title: string;
    message: React.ReactNode;
  } | null>(null);

  // Migration 진행 중 실시간 리스너 억제 (onSnapshot이 중간 상태로 덮어쓰는 것 방지)
  const realtimePausedRef = useRef(false);

  return {
    user, setUser,
    isDarkMode, setIsDarkMode,
    inventory, setInventory,
    transactions, setTransactions,
    masterData, setMasterData,
    users, setUsers,
    currentView, setCurrentView,
    isSidebarOpen, setIsSidebarOpen,
    showStockForm, setShowStockForm,
    editingItem, setEditingItem,
    showTransactionModal, setShowTransactionModal,
    transactionItem, setTransactionItem,
    showDBManager, setShowDBManager,
    showUserManager, setShowUserManager,
    showMasterDataManager, setShowMasterDataManager,
    showDuplicateItemManager, setShowDuplicateItemManager,
    showMonthlyReport, setShowMonthlyReport,
    showMonthlyUsageReport, setShowMonthlyUsageReport,
    showLogoutConfirm, setShowLogoutConfirm,
    showManual, setShowManual,
    showSuccessModal, setShowSuccessModal,
    successMessage, setSuccessMessage,
    alertModal, setAlertModal,
    confirmModal, setConfirmModal,
    progressModal, setProgressModal,
    realtimePausedRef,
  };
}
