/**
 * useAppHandlers.ts — Ver5.3.0 리팩토링
 * 모든 비즈니스 로직 핸들러 모음
 * - Inventory CRUD
 * - Transaction CRUD
 * - Excel/History Import
 * - DB Reset / Restore
 * - Login / Logout
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { InventoryItem, InventoryTransaction, MasterData, User } from '../types';
import { api } from '../utils/api';
import { ActionLogger } from '../utils/logger';
import {
  AppState,
  isCarryOverReason,
  normalizeDateString,
  normalizeTransactions,
} from './useAppState';

// ─── progress helper ─────────────────────────────────────────────────────────
function makeProgressMsg(text: string): React.ReactNode {
  return (
    <div className="flex items-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-orange-600 dark:text-orange-400" />
      <span>{text}</span>
    </div>
  );
}

async function runWithProgress<T>(
  title: string,
  message: React.ReactNode,
  task: () => Promise<T>,
  setProgressModal: AppState['setProgressModal']
): Promise<T> {
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    setProgressModal({ title, message });
  }, 1000);
  try {
    return await task();
  } finally {
    clearTimeout(timer);
    if (shown) setProgressModal(null);
  }
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useAppHandlers(state: AppState) {
  const {
    user,
    inventory,
    transactions,
    masterData,
    setUser,
    setCurrentView,
    setShowStockForm,
    setEditingItem,
    setShowTransactionModal,
    setTransactionItem,
    setShowLogoutConfirm,
    setMasterData,
    setSuccessMessage,
    setShowSuccessModal,
    setAlertModal,
    setConfirmModal,
    setProgressModal,
  } = state;

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleLogin = (loggedInUser: User) => {
    try {
      sessionStorage.setItem('kdt_active_user', JSON.stringify(loggedInUser));
    } catch {}
    setUser(loggedInUser);
    ActionLogger.log('User Logged In', { user: loggedInUser.name });
  };

  const handleLogout = async (isForced = false) => {
    if (user && !isForced) {
      try {
        await api.logout({ userId: user.id, device: 'desktop' });
      } catch (e) {
        console.error('Logout sync failed', e);
      }
    }
    try {
      sessionStorage.removeItem('kdt_active_user');
      sessionStorage.removeItem('kdt_active_view');
    } catch {}
    setUser(null);
    localStorage.removeItem('session_token');
    setCurrentView('DASHBOARD');
    setShowLogoutConfirm(false);
    if (!isForced) ActionLogger.log('User Logged Out');
  };

  // ── Inventory CRUD ────────────────────────────────────────────────────────

  const handleAddItem = () => {
    setEditingItem(undefined);
    setShowStockForm(true);
  };

  const handleEditItem = (id: string) => {
    const item = inventory.find((i) => i.id === id);
    if (item) {
      setEditingItem(item);
      setShowStockForm(true);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setConfirmModal({
      title: '품목 삭제',
      message: '정말로 이 항목을 삭제하시겠습니까?\n관련된 입출고 이력은 유지됩니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.deleteItem(id);
          ActionLogger.log('Inventory Item Deleted (DB)', { id });
        } catch (e) {
          setAlertModal({ title: '삭제 실패', message: '삭제 실패: ' + e });
        }
      },
    });
  };

  const handleSaveItem = async (item: InventoryItem) => {
    try {
      await api.saveItem(item);
      setShowStockForm(false);
      ActionLogger.log('Inventory Item Saved (DB)', { name: item.name });

      // [Ver5.3.0 FIX] 신규등록 시 masterData에 대분류/소분류 동기화
      const catExists = masterData.categories.includes(item.category);
      const nameExists = (masterData.namesByCategory[item.category] || []).includes(item.name);

      if (!catExists || !nameExists) {
        const newCategories = catExists
          ? masterData.categories
          : [...masterData.categories, item.category];
        const existingNames = masterData.namesByCategory[item.category] || [];
        const newNames = nameExists ? existingNames : [...existingNames, item.name];
        const newNamesByCategory = { ...masterData.namesByCategory, [item.category]: newNames };
        const newNameOrder = nameExists
          ? masterData.nameOrder
          : [...masterData.nameOrder, item.name];

        await api.saveMasterData({
          categories: newCategories,
          namesByCategory: newNamesByCategory,
          nameOrder: newNameOrder,
        });
        // Firestore onSnapshot이 masterData state 자동 갱신
      }
    } catch (e) {
      setAlertModal({ title: '저장 실패', message: '저장 실패: ' + e });
    }
  };

  // ── Transactions ──────────────────────────────────────────────────────────

  const openTransactionModal = (item: InventoryItem) => {
    setTransactionItem(item);
    setShowTransactionModal(true);
  };

  const handleTransactionSave = async (
    txData: Omit<InventoryTransaction, 'id' | 'currentStockSnapshot'>
  ) => {
    const normalizedDate = normalizeDateString(txData.date);
    const isCarryOver = isCarryOverReason(txData.reason);

    const existingTx = transactions.find(
      (tx) =>
        tx.itemId === txData.itemId &&
        tx.type === txData.type &&
        tx.date === normalizedDate &&
        isCarryOverReason(tx.reason) === isCarryOver
    );

    if (existingTx) {
      const typeLabel = txData.type === 'IN' ? '입고' : '출고';
      setAlertModal({
        title: '동일 이력 존재',
        message: (
          <div>
            <p><strong>{txData.itemName}</strong> 품목의 <strong>{normalizedDate}</strong> 일자에</p>
            <p>이미 <strong>{typeLabel}</strong> 이력이 등록되어 있습니다.</p>
            <p className="text-sm text-slate-500 mt-3">
              기존 수량: <strong>{existingTx.quantity}</strong> →
              수량을 변경하려면 기존 이력을 수정해 주세요.
            </p>
          </div>
        ),
      });
      return;
    }

    try {
      const newId = `TX-${Date.now()}`;
      const finalTx = { ...txData, id: newId, date: normalizedDate };
      await api.saveTransaction(finalTx);
      ActionLogger.log('Transaction Recorded (DB)', { type: txData.type, item: txData.itemName });
    } catch (e) {
      setAlertModal({ title: '저장 실패', message: '이력 저장 실패: ' + e });
    }
  };

  const handleTransactionUpdate = async (
    oldTx: InventoryTransaction,
    newTxData: Partial<InventoryTransaction>
  ) => {
    try {
      await api.updateTransaction(oldTx.id, newTxData);
      ActionLogger.log('Transaction Updated (DB)', { id: oldTx.id });
    } catch (e) {
      setAlertModal({ title: '수정 실패', message: '수정 실패: ' + e });
    }
  };

  const handleTransactionDelete = async (tx: InventoryTransaction) => {
    try {
      await api.deleteTransaction(tx.id);
      ActionLogger.log('Transaction Deleted (DB)', { id: tx.id });
    } catch (e) {
      setAlertModal({ title: '삭제 실패', message: '삭제 실패: ' + e });
    }
  };

  // ── Excel Import ──────────────────────────────────────────────────────────

  const handleExcelImport = async (importedItems: InventoryItem[]) => {
    try {
      await runWithProgress(
        '일괄등록 진행',
        makeProgressMsg('서버 동기화 중입니다. 잠시만 기다려 주세요.'),
        async () => {
          const makeKdtKey = (it: InventoryItem) =>
            `${(it.category || '').trim().toLowerCase()}|${(it.name || '').trim().toLowerCase()}|${(it.plating || '').trim().toLowerCase()}|${(it.spec || '').trim().toLowerCase()}`;
          const existingMap = new Map<string, InventoryItem>();
          inventory.forEach((item) => {
            existingMap.set(makeKdtKey(item), item);
          });

          let addedCount = 0;
          let updatedCount = 0;
          const mergedMap = new Map<string, InventoryItem>();
          const processedIds = new Set<string>();

          for (const item of importedItems) {
            const key = makeKdtKey(item);
            const existing = existingMap.get(key);
            if (existing) {
              mergedMap.set(existing.id, { ...existing, ...item, id: existing.id });
              processedIds.add(existing.id);
              updatedCount++;
            } else {
              mergedMap.set(item.id, item);
              processedIds.add(item.id);
              addedCount++;
            }
          }

          for (const item of inventory) {
            if (!processedIds.has(item.id)) {
              mergedMap.set(item.id, item);
            }
          }

          const mergedInventory = Array.from(mergedMap.values());
          const nextMasterData: MasterData = {
            ...masterData,
            categories: [...masterData.categories],
            namesByCategory: { ...masterData.namesByCategory },
            nameOrder: [...masterData.nameOrder],
            zoneMeta: { ...(masterData.zoneMeta || {}) },
          };

          importedItems.forEach((item) => {
            const category = (item.category || '').trim();
            const name = (item.name || '').trim();
            if (!category) return;

            if (!nextMasterData.categories.includes(category)) {
              nextMasterData.categories.push(category);
            }
            const categoryNames = nextMasterData.namesByCategory[category] || [];
            if (name && !categoryNames.includes(name)) {
              nextMasterData.namesByCategory[category] = [...categoryNames, name];
            }
            if (name && !nextMasterData.nameOrder.includes(name)) {
              nextMasterData.nameOrder.push(name);
            }

            const matchingZone = Object.values(nextMasterData.zoneMeta || {}).find(
              (zone) => zone.displayName === category
            );
            if (!matchingZone) {
              const zoneId = item.zoneId || category;
              nextMasterData.zoneMeta![zoneId] = {
                zoneId,
                displayName: category,
                aliasHistory: [],
              };
            }
          });

          await Promise.all([
            api.migrateData({ inventory: mergedInventory, transactions }),
            api.saveMasterData(nextMasterData),
          ]);
          setMasterData(nextMasterData);

          const parts = [];
          if (addedCount > 0) parts.push(`신규 ${addedCount}건`);
          if (updatedCount > 0) parts.push(`업데이트 ${updatedCount}건`);
          setSuccessMessage(`${parts.join(', ')} 등록 완료`);
          setShowSuccessModal(true);
          setCurrentView('INVENTORY');
        },
        setProgressModal
      );
    } catch (e) {
      setAlertModal({ title: '일괄 등록 오류', message: '일괄 등록 중 오류: ' + e });
    }
  };

  // ── History Import ────────────────────────────────────────────────────────

  const handleHistoryImport = async (importedTransactions: InventoryTransaction[]) => {
    if (!importedTransactions || importedTransactions.length === 0) {
      setAlertModal({ title: '등록 오류', message: '저장할 데이터가 없습니다.' });
      return;
    }

    try {
      const currentTransactions = normalizeTransactions(await api.getTransactions());
      const transactionKey = (tx: InventoryTransaction, dateOverride?: string) => {
        const dateValue = dateOverride ?? normalizeDateString(tx.date);
        const carryTag = isCarryOverReason(tx.reason) ? 'CARRY' : 'NORMAL';
        return `${tx.itemId}|${tx.type}|${dateValue}|${carryTag}`;
      };

      const txMap = new Map<string, InventoryTransaction[]>();
      for (const tx of currentTransactions) {
        const key = transactionKey(tx);
        const list = txMap.get(key);
        if (list) list.push(tx);
        else txMap.set(key, [tx]);
      }

      const createList: InventoryTransaction[] = [];
      const updateList: Array<{ id: string; data: Partial<InventoryTransaction> }> = [];
      const deleteList: string[] = [];
      const cleanDuplicateIds = new Set<string>();

      for (const tx of importedTransactions) {
        const normalizedDate = normalizeDateString(tx.date);
        const key = transactionKey(tx, normalizedDate);
        const existingList = txMap.get(key) ?? [];

        if (existingList.length > 1) {
          for (const extra of existingList.slice(1)) cleanDuplicateIds.add(extra.id);
        }

        const existingTx = existingList[0];
        const newQty = Number(tx.quantity);

        if (existingTx) {
          const oldQty = Number(existingTx.quantity);
          if (newQty === 0) {
            deleteList.push(existingTx.id);
          } else if (oldQty !== newQty || existingTx.reason !== tx.reason) {
            updateList.push({
              id: existingTx.id,
              data: { quantity: newQty, worker: tx.worker, department: tx.department, reason: tx.reason },
            });
          }
        } else if (newQty !== 0) {
          const txId = tx.id || `BATCH-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
          createList.push({ ...tx, id: txId, date: normalizedDate });
        }
      }

      const summaryMessage = (
        <div className="space-y-2">
          <div>인식된 수불부 {importedTransactions.length.toLocaleString()}건을 DB에 반영합니다.</div>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <li>신규 등록: {createList.length.toLocaleString()}건</li>
            <li>수정: {updateList.length.toLocaleString()}건</li>
            <li>삭제: {deleteList.length.toLocaleString()}건</li>
            <li>기존 중복 정리: {cleanDuplicateIds.size.toLocaleString()}건</li>
          </ul>
        </div>
      );

      setConfirmModal({
        title: '수불부 등록 확인',
        message: summaryMessage,
        confirmLabel: '등록',
        cancelLabel: '취소',
        onConfirm: async () => {
          setConfirmModal(null);
          try {
            await runWithProgress(
              '수불부 등록 진행',
              makeProgressMsg('서버에 수불부를 반영하고 있습니다. 잠시만 기다려 주세요.'),
              async () => {
                const txById = new Map<string, InventoryTransaction>(
                  currentTransactions.map((tx) => [tx.id, tx])
                );

                for (const id of cleanDuplicateIds) txById.delete(id);
                for (const id of deleteList) txById.delete(id);
                for (const entry of updateList) {
                  const existing = txById.get(entry.id);
                  if (existing) txById.set(entry.id, { ...existing, ...entry.data });
                }
                for (const tx of createList) txById.set(tx.id, tx);

                const finalTransactions = Array.from(txById.values());
                const latestInventory = await api.getInventory();

                // masterData 기반 정렬 보존
                const catMap = new Map<string, number>();
                masterData.categories.forEach((c, i) => catMap.set(c, i));
                const nameMap = new Map<string, Map<string, number>>();
                Object.entries(masterData.namesByCategory).forEach(([c, names]) => {
                  const m = new Map<string, number>();
                  names.forEach((n, i) => m.set(n, i));
                  nameMap.set(c, m);
                });

                latestInventory.sort((a, b) => {
                  const cA = catMap.get(a.category);
                  const cB = catMap.get(b.category);
                  if (cA !== undefined && cB !== undefined && cA !== cB) return cA - cB;
                  if (cA !== undefined && cB === undefined) return -1;
                  if (cA === undefined && cB !== undefined) return 1;
                  const nmA = nameMap.get(a.category);
                  if (nmA) {
                    const nA = nmA.get(a.name);
                    const nB = nmA.get(b.name);
                    if (nA !== undefined && nB !== undefined && nA !== nB) return nA - nB;
                    if (nA !== undefined && nB === undefined) return -1;
                    if (nA === undefined && nB !== undefined) return 1;
                  }
                  return (a.name || '').localeCompare(b.name || '');
                });

                // 재고 재계산
                const calculatedStock = new Map<string, number>();
                latestInventory.forEach((item) => calculatedStock.set(item.id, 0));
                finalTransactions.forEach((tx) => {
                  if (calculatedStock.has(tx.itemId)) {
                    const qty = Number(tx.quantity) || 0;
                    const delta = tx.type === 'IN' ? qty : -qty;
                    calculatedStock.set(tx.itemId, (calculatedStock.get(tx.itemId) || 0) + delta);
                  }
                });

                const finalInventory = latestInventory.map((item) => ({
                  ...item,
                  currentStock: calculatedStock.get(item.id) ?? Number(item.currentStock) ?? 0,
                }));

                await api.migrateData({ inventory: finalInventory, transactions: finalTransactions });

                let msg = `검증 및 등록 완료\n`;
                if (createList.length > 0) msg += `- 신규 등록: ${createList.length}건\n`;
                if (updateList.length > 0) msg += `- 수정됨: ${updateList.length}건\n`;
                if (deleteList.length > 0) msg += `- 삭제됨: ${deleteList.length}건\n`;
                if (cleanDuplicateIds.size > 0) msg += `- 기존 중복 정리: ${cleanDuplicateIds.size}건\n`;
                setSuccessMessage(msg);
                setShowSuccessModal(true);
                setCurrentView('INVENTORY');
              },
              setProgressModal
            );
          } catch (e) {
            console.error(e);
            setAlertModal({ title: '이력 등록 오류', message: '이력 등록 중 오류: ' + e });
          }
        },
      });
    } catch (e) {
      console.error(e);
      setAlertModal({ title: '이력 등록 오류', message: '이력 등록 중 오류: ' + e });
    }
  };

  // ── DB Reset ──────────────────────────────────────────────────────────────

  const handleResetInventoryRequest = () => {
    setConfirmModal({
      title: 'DB 초기화',
      message: (
        <div>
          <p className="font-bold text-red-600 mb-2">⚠️ 모든 데이터가 삭제됩니다!</p>
          <p>재고 데이터, 입출고 이력이 <strong>초기 데이터</strong>로 돌아갑니다.</p>
          <p className="mt-2 text-sm text-slate-500">이 작업은 되돌릴 수 없습니다.</p>
        </div>
      ),
      confirmLabel: '초기화 실행',
      isDangerous: true,
      onConfirm: async () => {
        try {
          setConfirmModal(null);
          setProgressModal({
            title: 'DB 초기화',
            message: (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                <span>DB 초기화 중... 잠시만 기다려 주세요.</span>
              </div>
            ),
          });

          const apiBase =
            window.location.port === '5173'
              ? `http://${window.location.hostname}:3500/api`
              : '/api';

          const migrationRes = await fetch(`${apiBase}/migration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inventory: [], transactions: [] }),
          });
          if (!migrationRes.ok) {
            const errBody = await migrationRes.text();
            throw new Error(`Migration API failed (${migrationRes.status}): ${errBody}`);
          }

          await fetch('/masterData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} }),
          });
          setMasterData({ categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} });
          localStorage.removeItem('kdt_inventory');
          localStorage.removeItem('kdt_transactions');

          setProgressModal(null);
          setSuccessMessage('DB가 초기화되었습니다.');
          setShowSuccessModal(true);
          setCurrentView('INVENTORY');
          ActionLogger.log('DB Reset Completed');
        } catch (e) {
          setProgressModal(null);
          setAlertModal({ title: '초기화 실패', message: 'DB 초기화 실패: ' + e });
        }
      },
    });
  };

  // ── DB Restore ────────────────────────────────────────────────────────────

  const handleDBImport = async (data: {
    inventory: InventoryItem[];
    transactions: InventoryTransaction[];
    masterData?: MasterData;
  }) => {
    try {
      await api.migrateData(data);
      setCurrentView('INVENTORY');
      ActionLogger.log('System Restore Completed');
    } catch (e) {
      setAlertModal({ title: '복원 실패', message: '복원 실패: ' + e });
    }
  };

  return {
    handleLogin,
    handleLogout,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    openTransactionModal,
    handleTransactionSave,
    handleTransactionUpdate,
    handleTransactionDelete,
    handleExcelImport,
    handleHistoryImport,
    handleResetInventoryRequest,
    handleDBImport,
  };
}
