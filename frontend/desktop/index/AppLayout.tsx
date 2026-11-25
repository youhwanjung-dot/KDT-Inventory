import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  BarChart2,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  Users,
  History,
  Moon,
  Sun,
  Box,
  BookOpen,
  FileText,
  Activity,
  ChevronDown,
  ChevronRight,
  GitMerge,
} from 'lucide-react';

import Login from '../components/Login';
import Dashboard from '../components/Dashboard';
import InventoryList from '../components/InventoryList';
import StockForm from '../components/StockForm';
import TransactionModal from '../components/TransactionModal';
import ExcelImport from '../components/ExcelImport';
import TransactionHistoryImport from '../components/TransactionHistoryImport';
import DataMigrationModal from '../components/DataMigrationModal';
import UserManagerModal from '../components/UserManagerModal';
import MasterDataManagerModal from '../components/MasterDataManagerModal';
import DuplicateItemManager from '../components/DuplicateItemManager';
import MonthlyReportModal from '../components/MonthlyReportModal';
import MonthlyUsageReportModal from '../components/MonthlyUsageReportModal';
import ConfirmationModal from '../components/ConfirmationModal';
import ManualModal from '../components/ManualModal';
import ProgressModal from '../components/ProgressModal';
import InventoryReport from '../components/InventoryReport';

import { InventoryItem, InventoryTransaction, ViewState } from '../types';
import { APP_VERSION, COL_WIDTHS_STORAGE_KEY } from '../constants';
import { ActionLogger } from '../utils/logger';
import { api } from '../utils/api';
import { AppState } from './useAppState';

interface AppLayoutProps {
  state: AppState;
  handlers: {
    handleLogin: (user: any) => void;
    handleLogout: (isForced?: boolean) => void;
    handleAddItem: () => void;
    handleEditItem: (target: string | InventoryItem) => void;
    handleDeleteItem: (id: string) => void;
    handleSaveItem: (item: InventoryItem, applyAcrossZones?: boolean) => void;
    handleMergeDuplicates: (survivorId: string, mergedIds: string[]) => void;
    handleDeleteDuplicates: (ids: string[]) => void;
    openTransactionModal: (item: InventoryItem) => void;
    handleTransactionSave: (txData: any) => void;
    handleTransactionUpdate: (oldTx: InventoryTransaction, newTxData: any) => void;
    handleTransactionDelete: (tx: InventoryTransaction) => void;
    handleExcelImport: (items: InventoryItem[], applyAcrossZones: boolean) => void;
    handleHistoryImport: (
      txs: InventoryTransaction[],
      itemsToRegister: InventoryItem[],
      applyAcrossZones: boolean
    ) => void;
    handleResetInventoryRequest: () => void;
    handleDBImport: (data: any) => void;
  };
}

const MENU_ITEMS = [
  { id: 'DASHBOARD',      label: '대시보드',     icon: LayoutDashboard, adminOnly: false },
  { id: 'INVENTORY',      label: '재고현황',      icon: Package, adminOnly: false },
  { id: 'ANALYSIS',       label: '재고분석 보고서', icon: BarChart2, adminOnly: false },
  { id: 'STOCK_REPORT',   label: '재고현황 보고서', icon: FileText, adminOnly: false },
  { id: 'USAGE_REPORT',   label: '사용현황 보고서', icon: Activity, adminOnly: false },
  { id: 'IMPORT',         label: '일괄등록',       icon: FileSpreadsheet, adminOnly: true },
  { id: 'HISTORY_IMPORT', label: '수불부 등록',    icon: History, adminOnly: true },
];

const IDLE_LOGOUT_TIMEOUT_MS = 5 * 60 * 1000;

const getPermissionLabel = (role: string, txPermission?: string): string => {
  if (role === 'admin') return '시스템 관리자';
  if (txPermission === 'IN_ONLY') return '입고 담당';
  if (txPermission === 'OUT_ONLY') return '출고 담당';
  return '일반 사용자';
};

const AppLayout: React.FC<AppLayoutProps> = ({ state, handlers }) => {
  const {
    user,
    setUser,
    isDarkMode, setIsDarkMode,
    inventory, setInventory,
    transactions, setTransactions,
    masterData, setMasterData,
    users, setUsers,
    currentView, setCurrentView,
    isSidebarOpen, setIsSidebarOpen,
    showStockForm, setShowStockForm,
    editingItem,
    showTransactionModal, setShowTransactionModal,
    transactionItem,
    showDBManager, setShowDBManager,
    showUserManager, setShowUserManager,
    showMasterDataManager, setShowMasterDataManager,
    showDuplicateItemManager, setShowDuplicateItemManager,
    showMonthlyReport, setShowMonthlyReport,
    showMonthlyUsageReport, setShowMonthlyUsageReport,
    showLogoutConfirm, setShowLogoutConfirm,
    showManual, setShowManual,
    showSuccessModal, setShowSuccessModal,
    successMessage,
    alertModal, setAlertModal,
    confirmModal, setConfirmModal,
    progressModal,
  } = state;

  const [inventoryFilterMode, setInventoryFilterMode] = useState<'ALL' | 'LOW_STOCK'>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [stockReportRequest, setStockReportRequest] = useState(0);
  const [showUsageReportOptions, setShowUsageReportOptions] = useState(false);
  const [usageReportMode, setUsageReportMode] = useState<'MONTHLY' | 'ANNUAL' | 'ZONE'>('ANNUAL');
  const userRole = user?.role;

  useEffect(() => {
    const VIEW_TITLES: Record<string, string> = {
      DASHBOARD: '대시보드 | KDT 자재 재고관리',
      INVENTORY: '재고현황 | KDT 자재 재고관리',
      ANALYSIS: '재고 분석보고서 | KDT 자재 재고관리',
      IMPORT: '일괄 등록 | KDT 자재 재고관리',
      HISTORY_IMPORT: '수불부 등록 | KDT 자재 재고관리',
    };
    document.title = VIEW_TITLES[currentView] || 'KDT 자재 재고관리 시스템';
  }, [currentView]);

  useEffect(() => {
    if (
      userRole &&
      userRole !== 'admin' &&
      (currentView === 'IMPORT' || currentView === 'HISTORY_IMPORT')
    ) {
      setCurrentView('DASHBOARD');
    }
  }, [userRole, currentView, setCurrentView]);

  const {
    handleLogin,
    handleLogout,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    handleMergeDuplicates,
    handleDeleteDuplicates,
    openTransactionModal,
    handleTransactionSave,
    handleTransactionUpdate,
    handleTransactionDelete,
    handleExcelImport,
    handleHistoryImport,
    handleResetInventoryRequest,
    handleDBImport,
  } = handlers;

  const logoutHandlerRef = useRef(handleLogout);
  useEffect(() => {
    logoutHandlerRef.current = handleLogout;
  }, [handleLogout]);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    let lastActivityAt = Date.now();
    let timeoutId: number | undefined;

    const checkIdleTimeout = () => {
      const remaining = IDLE_LOGOUT_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remaining <= 0) {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        timeoutId = undefined;
        void logoutHandlerRef.current();
        return;
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(checkIdleTimeout, remaining);
    };

    const recordActivity = () => {
      lastActivityAt = Date.now();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(checkIdleTimeout, IDLE_LOGOUT_TIMEOUT_MS);
    };

    const checkWhenVisible = () => {
      // 모니터가 다시 켜지는 순간(lastActivityAt 갱신) 즉시 로그아웃되지 않도록
      // 깜빡임 현상 방지 + 사용자에게 5분 여유 제공
      if (document.visibilityState === 'visible') {
        lastActivityAt = Date.now();
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(checkIdleTimeout, IDLE_LOGOUT_TIMEOUT_MS);
      }
    };

    timeoutId = window.setTimeout(checkIdleTimeout, IDLE_LOGOUT_TIMEOUT_MS);
    window.addEventListener('pointermove', recordActivity);
    window.addEventListener('pointerdown', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('touchstart', recordActivity, { passive: true });
    window.addEventListener('touchmove', recordActivity, { passive: true });
    window.addEventListener('wheel', recordActivity, { passive: true });
    document.addEventListener('visibilitychange', checkWhenVisible);

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.removeEventListener('pointermove', recordActivity);
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('touchmove', recordActivity);
      window.removeEventListener('wheel', recordActivity);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [userId]);

  if (!user) {
    return (
      <Login
        users={users}
        onLogin={handleLogin}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 transition-colors overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-64' : 'w-20'
          } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20 shadow-xl`}
      >
        <div className="p-4 h-16 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          {isSidebarOpen && (
            <span className="font-bold text-xl text-orange-600 dark:text-orange-400 tracking-tight whitespace-nowrap">
              KDT <span className="text-slate-400 font-normal">Inventory</span>
            </span>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {MENU_ITEMS.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => {
            const isActive =
              item.id === 'STOCK_REPORT'
                ? false
                : item.id === 'USAGE_REPORT'
                  ? showUsageReportOptions || showMonthlyUsageReport
                  : currentView === item.id;

            return (
              <React.Fragment key={item.id}>
                <button
                  onClick={() => {
                    if (item.id === 'STOCK_REPORT') {
                      setCurrentView('INVENTORY');
                      setStockReportRequest((request) => request + 1);
                    } else if (item.id === 'USAGE_REPORT') {
                      if (!isSidebarOpen) setIsSidebarOpen(true);
                      setShowUsageReportOptions((open) => !open);
                    } else {
                      setCurrentView(item.id as ViewState);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  aria-expanded={item.id === 'USAGE_REPORT' ? showUsageReportOptions : undefined}
                >
                  <item.icon size={22} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-orange-500 transition-colors'} />
                  {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                  {item.id === 'USAGE_REPORT' && isSidebarOpen && (
                    showUsageReportOptions
                      ? <ChevronDown size={16} className="ml-auto" />
                      : <ChevronRight size={16} className="ml-auto" />
                  )}
                </button>
                {item.id === 'USAGE_REPORT' && showUsageReportOptions && isSidebarOpen && (
                  <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2 space-y-1">
                    <button
                      onClick={() => {
                        setUsageReportMode('MONTHLY');
                        setShowUsageReportOptions(false);
                        setShowMonthlyUsageReport(true);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      월간
                    </button>
                    <button
                      onClick={() => {
                        setUsageReportMode('ANNUAL');
                        setShowUsageReportOptions(false);
                        setShowMonthlyUsageReport(true);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      연간
                    </button>
                    <button
                      onClick={() => {
                        setUsageReportMode('ZONE');
                        setShowUsageReportOptions(false);
                        setShowMonthlyUsageReport(true);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ZONE별
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1 shrink-0">
          {user.role === 'admin' && (
            <>
              <button
                onClick={() => setShowMasterDataManager(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="ZONE(대분류) 및 품목 기준 정보 관리"
              >
                <Box size={20} className="text-orange-500" />
                {isSidebarOpen && <span className="text-sm">ZONE·기준정보 관리</span>}
              </button>
              <button
                onClick={() => setShowDuplicateItemManager(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="중복 품목 탐지 및 병합·삭제"
              >
                <GitMerge size={20} className="text-purple-500" />
                {isSidebarOpen && <span className="text-sm">중복품목 관리</span>}
              </button>
              <button
                onClick={() => setShowUserManager(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="사용자 및 입출고 권한 관리"
              >
                <Users size={20} className="text-slate-500" />
                {isSidebarOpen && <span className="text-sm">사용자 관리</span>}
              </button>
            </>
          )}

          <button
            onClick={() => setShowManual(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="시스템 사용 매뉴얼"
          >
            <BookOpen size={20} className="text-emerald-500" />
            {isSidebarOpen && <span className="text-sm">시스템 매뉴얼</span>}
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-400" />}
            {isSidebarOpen && <span className="text-sm">{isDarkMode ? '라이트 모드' : '다크 모드'}</span>}
          </button>

          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <LogOut size={20} />
              {isSidebarOpen && <span className="text-sm font-bold">로그아웃</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {currentView === 'ANALYSIS'
              ? '재고분석 보고서'
              : currentView === 'INVENTORY'
                ? '재고현황'
                : MENU_ITEMS.find((i) => i.id === currentView)?.label}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getPermissionLabel(user.role, user.txPermission)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
              {user.name[0]}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 sm:p-6 relative">
          {currentView === 'DASHBOARD' && (
            <Dashboard
              items={inventory}
              transactions={transactions}
              isDarkMode={isDarkMode}
              onNavigate={(view, filterMode, categoryFilter) => {
                setCurrentView(view);
                setInventoryFilterMode(filterMode || 'ALL');
                setSelectedCategoryFilter(categoryFilter || null);
              }}
            />
          )}
          {currentView === 'INVENTORY' && (
            <InventoryList
              items={inventory}
              transactions={transactions}
              masterData={masterData}
              user={user}
              initialFilterMode={inventoryFilterMode}
              initialCategoryFilter={selectedCategoryFilter}
              stockReportRequest={stockReportRequest}
              onAdd={handleAddItem}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onReset={handleResetInventoryRequest}
              onOpenDBManager={() => setShowDBManager(true)}
              onTransaction={openTransactionModal}
              onOpenMonthlyReport={() => setShowMonthlyReport(true)}
            />
          )}
          {user.role === 'admin' && currentView === 'IMPORT' && (
            <ExcelImport
              onImport={handleExcelImport}
              onRestore={handleDBImport}
              onCancel={() => setCurrentView('INVENTORY')}
              currentInventory={inventory}
            />
          )}
          {user.role === 'admin' && currentView === 'HISTORY_IMPORT' && (
            <TransactionHistoryImport
              onImport={handleHistoryImport}
              onCancel={() => setCurrentView('INVENTORY')}
              inventory={inventory}
            />
          )}
          {currentView === 'ANALYSIS' && (
            <InventoryReport
              items={inventory}
              transactions={transactions}
              onClose={() => setCurrentView('INVENTORY')}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {showStockForm && (
        <StockForm
          item={editingItem}
          inventory={inventory}
          masterData={masterData}
          onSave={handleSaveItem}
          onDelete={handleDeleteItem}
          onCancel={() => setShowStockForm(false)}
        />
      )}

      {showTransactionModal && transactionItem && (
        <TransactionModal
          item={transactionItem}
          transactions={transactions}
          currentUser={user}
          users={users}
          onSave={handleTransactionSave}
          onUpdate={handleTransactionUpdate}
          onDelete={handleTransactionDelete}
          onClose={() => setShowTransactionModal(false)}
        />
      )}

      {showDBManager && (
        <DataMigrationModal
          items={inventory}
          transactions={transactions}
          masterData={masterData}
          onImport={handleDBImport}
          onClose={() => setShowDBManager(false)}
        />
      )}

      {showUserManager && (
        <UserManagerModal
          users={users}
          onUpdateUsers={(updatedUsers) => {
            setUsers(updatedUsers);
            if (user) {
              const refreshedUser = updatedUsers.find((candidate) => candidate.id === user.id);
              if (refreshedUser) {
                setUser({ ...user, ...refreshedUser });
              }
            }
          }}
          onClose={() => setShowUserManager(false)}
        />
      )}

      {showMasterDataManager && (
        <MasterDataManagerModal
          inventory={inventory}
          transactions={transactions}
          masterData={masterData}
          onMasterDataChange={setMasterData}
          onUpdateInventory={async (newInventory, changedItems, deleteItemIds, syncTransactionNames) => {
            setInventory(newInventory);
            try {
              const deleteSet = new Set<string>(deleteItemIds ?? []);
              const changedMap = new Map<string, InventoryItem>(
                (changedItems ?? []).map((item) => [item.id, item])
              );
              const finalInventory = newInventory
                .filter((item) => !deleteSet.has(item.id))
                .map((item) => changedMap.get(item.id) ?? item);

              const inventoryById = new Map(finalInventory.map((item) => [item.id, item]));
              let updatedTransactionNames = 0;
              const finalTransactions = transactions
                .filter((tx) => !deleteSet.has(tx.itemId))
                .map((tx) => {
                  if (!syncTransactionNames) return tx;
                  const currentItem = inventoryById.get(tx.itemId);
                  if (!currentItem || tx.itemName === currentItem.name) return tx;
                  updatedTransactionNames++;
                  return { ...tx, itemName: currentItem.name };
                });

              await api.migrateData({ inventory: finalInventory, transactions: finalTransactions });
              setTransactions(finalTransactions);
              ActionLogger.log('Master Data Saved (batch)', {
                deleted: deleteSet.size,
                changed: (changedItems ?? []).length,
                txRemoved: transactions.length - finalTransactions.length,
                txNamesUpdated: updatedTransactionNames,
              });
              return updatedTransactionNames;
            } catch (e) {
              console.error('Failed to save master data:', e);
              setAlertModal({ title: '저장 실패', message: '기준정보 저장 실패: ' + e });
              return null;
            }
          }}
          onNormalizeZoneItems={async (normalizedInventory, normalizedMasterData) => {
            try {
              const result = await api.migrateData({
                inventory: normalizedInventory,
                transactions,
                masterData: normalizedMasterData,
              });
              if (
                result.inventoryCount !== normalizedInventory.length ||
                result.transactionCount !== transactions.length
              ) {
                throw new Error('서버 저장 건수가 요청한 데이터와 일치하지 않습니다.');
              }
              setInventory(normalizedInventory);
              setMasterData(normalizedMasterData);
              ActionLogger.log('ZONE Shared Item Sync Saved', {
                inventoryCount: normalizedInventory.length,
                transactionCount: transactions.length,
              });
              return true;
            } catch (error) {
              console.error('Failed to normalize shared ZONE items:', error);
              setAlertModal({ title: 'ZONE 품목 동기화 실패', message: '공통 품목 동기화에 실패했습니다: ' + error });
              return false;
            }
          }}
          onCreateZoneItems={async (category, zoneItems, nextMasterData) => {
            await api.saveMasterData(nextMasterData);
            const results = await Promise.allSettled(zoneItems.map((item) => api.saveItem(item)));
            const savedItems = zoneItems.filter((_, index) => results[index].status === 'fulfilled');
            const failedItemCount = zoneItems.length - savedItems.length;

            setInventory((prev) => {
              const existingIds = new Set(prev.map((item) => item.id));
              return [...prev, ...savedItems.filter((item) => !existingIds.has(item.id))];
            });
            setMasterData(nextMasterData);
            ActionLogger.log('ZONE Items Provisioned', {
              category,
              requested: zoneItems.length,
              saved: savedItems.length,
              failed: failedItemCount,
            });
            return {
              masterData: nextMasterData,
              savedItemCount: savedItems.length,
              failedItemCount,
            };
          }}
          onCreateItems={async (categories, name) => {
            const missingItems = categories
              .filter(
                (category) =>
                  !inventory.some(
                    (item) =>
                      item.category === category &&
                      item.name === name &&
                      !String(item.plating || '').trim() &&
                      !String(item.spec || '').trim()
                  )
              )
              .map((category): InventoryItem => {
                const zoneMeta = Object.values(masterData.zoneMeta || {}).find(
                  (meta) => meta.displayName === category
                );
                return {
                  id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  category,
                  zoneId: zoneMeta?.zoneId || category,
                  name,
                  plating: '',
                  spec: '',
                  pkgUnit: '',
                  pkgType: '',
                  outerPkg: '',
                  unit: 'EA',
                  eaPerUnit: 1,
                  qtyPerProduct: 0,
                  setGroup: '',
                  currentStock: 0,
                  safeStock: 0,
                  location: '',
                  supplier: '',
                  note: '',
                  lastUpdated: new Date().toISOString().split('T')[0],
                  orderCategory: undefined,
                  orderName: undefined,
                };
              });
            if (missingItems.length === 0) return;

            const results = await Promise.allSettled(missingItems.map((item) => api.saveItem(item)));
            const savedItems = missingItems.filter((_, index) => results[index].status === 'fulfilled');
            if (savedItems.length > 0) {
              setInventory((prev) => {
                const makeKey = (item: InventoryItem) =>
                  [item.category, item.name, item.plating, item.spec]
                    .map((value) => String(value || '').trim().toLocaleLowerCase())
                    .join('\u0000');
                const existingKeys = new Set(prev.map(makeKey));
                return [
                  ...prev,
                  ...savedItems.filter((item) => !existingKeys.has(makeKey(item))),
                ];
              });
              ActionLogger.log('Auto-created shared items from Master Data', {
                name,
                categories: savedItems.map((item) => item.category),
              });
            }

            const failedCategories = missingItems
              .filter((_, index) => results[index].status === 'rejected')
              .map((item) => item.category);
            if (failedCategories.length > 0) {
              throw new Error(`다음 ZONE의 재고 품목 저장에 실패했습니다: ${failedCategories.join(', ')}`);
            }
          }}
          onEditItem={handleEditItem}
          onClose={() => setShowMasterDataManager(false)}
        />
      )}

      {showDuplicateItemManager && (
        <DuplicateItemManager
          inventory={inventory}
          transactions={transactions}
          onClose={() => setShowDuplicateItemManager(false)}
          onMerge={handleMergeDuplicates}
          onDelete={handleDeleteDuplicates}
        />
      )}

      {showMonthlyReport && (
        <MonthlyReportModal
          items={inventory}
          transactions={transactions}
          masterData={masterData}
          onClose={() => setShowMonthlyReport(false)}
          columnWidths={JSON.parse(localStorage.getItem(COL_WIDTHS_STORAGE_KEY) || '{}')}
        />
      )}

      {showMonthlyUsageReport && (
        <MonthlyUsageReportModal
          items={inventory}
          transactions={transactions}
          masterData={masterData}
          viewMode={usageReportMode}
          onClose={() => setShowMonthlyUsageReport(false)}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmationModal
          title="로그아웃 확인"
          message={
            <div>
              <p>현재 세션을 종료하고 로그인 화면으로 돌아가시겠습니까?</p>
              <p className="mt-2 text-sm text-orange-600 dark:text-orange-400 font-medium">
                변경된 모든 데이터는 시스템(DB)에 안전하게 저장됩니다.
              </p>
            </div>
          }
          confirmLabel="로그아웃"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showSuccessModal && (
        <ConfirmationModal
          title="등록 완료"
          message={successMessage}
          confirmLabel="확인"
          onConfirm={() => setShowSuccessModal(false)}
        />
      )}

      {alertModal && (
        <ConfirmationModal
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel="확인"
          isDangerous={alertModal.isDangerous}
          onConfirm={() => setAlertModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmationModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          isDangerous={confirmModal.isDangerous}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {progressModal && (
        <ProgressModal
          title={progressModal.title}
          message={progressModal.message}
        />
      )}

      {showManual && (
        <ManualModal user={user} onClose={() => setShowManual(false)} />
      )}

      {/* Version Stamp */}
      <div className="fixed bottom-2 right-2 text-[10px] text-slate-300 dark:text-slate-700 pointer-events-none z-50">
        Ver{APP_VERSION}
      </div>
    </div>
  );
};

export default AppLayout;
