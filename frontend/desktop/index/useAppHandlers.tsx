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
    setInventory,
    transactions,
    setTransactions,
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

  const handleSaveItem = async (item: InventoryItem, applyAcrossZones = false) => {
    try {
      await api.saveItem(item);
      setShowStockForm(false);
      ActionLogger.log('Inventory Item Saved (DB)', { name: item.name });

      const isNew = !inventory.some((i) => i.id === item.id);
      const allCategories = Array.from(
        new Set([...masterData.categories, ...inventory.map((existing) => existing.category), item.category].filter(Boolean))
      );

      if (isNew && applyAcrossZones) {
        const today = new Date().toISOString().slice(0, 10);
        const itemKey = (candidate: InventoryItem) =>
          [candidate.name, candidate.plating, candidate.spec]
            .map((part) => String(part || '').trim().toLocaleLowerCase())
            .join('\u0000');
        const missingCategories = allCategories.filter(
          (cat) =>
            cat !== item.category &&
            !inventory.some((existing) => existing.category === cat && itemKey(existing) === itemKey(item))
        );
        const sharedItems: InventoryItem[] = missingCategories.map((cat) => {
          const zoneMeta = Object.values(masterData.zoneMeta || {}).find(
            (meta) => meta.displayName === cat
          );
          return {
            ...item,
            id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            category: cat,
            zoneId: zoneMeta?.zoneId || cat,
            currentStock: 0,
            safeStock: 0,
            location: '',
            supplier: '',
            orderCategory: undefined,
            orderName: undefined,
            lastUpdated: today,
          };
        });

        if (sharedItems.length > 0) {
          const results = await Promise.allSettled(sharedItems.map((it) => api.saveItem(it)));
          const savedItems = sharedItems.filter((_, idx) => results[idx].status === 'fulfilled');
          if (savedItems.length > 0) {
            setInventory((prev) => [
              ...prev,
              ...savedItems.filter(
                (it) =>
                  !prev.some(
                    (p) =>
                      p.category === it.category &&
                      itemKey(p) === itemKey(it)
                  )
              ),
            ]);
            ActionLogger.log('Auto-created shared items across ZONEs', {
              name: item.name,
              categories: savedItems.map((it) => it.category),
            });
          }
          const failed = sharedItems
            .filter((_, idx) => results[idx].status === 'rejected')
            .map((it) => it.category);
          if (failed.length > 0) {
            setAlertModal({
              title: '일부 ZONE 저장 실패',
              message: `다음 ZONE의 재고 품목 저장에 실패했습니다: ${failed.join(', ')}`,
            });
          }
        }
      }

      const newCategories = allCategories;
      const newNamesByCategory = { ...masterData.namesByCategory };
      const newNameOrder = [...masterData.nameOrder];
      const nameCategories = applyAcrossZones ? newCategories : [item.category];
      for (const cat of nameCategories) {
        const existing = newNamesByCategory[cat] || [];
        if (!existing.includes(item.name)) {
          newNamesByCategory[cat] = [...existing, item.name];
        }
      }
      if (!newNameOrder.includes(item.name)) {
        newNameOrder.push(item.name);
      }
      await api.saveMasterData({
        categories: newCategories,
        namesByCategory: newNamesByCategory,
        nameOrder: newNameOrder,
        zoneMeta: masterData.zoneMeta || {},
      });
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

  const handleExcelImport = async (
    importedItems: InventoryItem[],
    applyAcrossZones = false
  ) => {
    try {
      await runWithProgress(
        '일괄등록 진행',
        makeProgressMsg('서버 동기화 중입니다. 잠시만 기다려 주세요.'),
        async () => {
          const makeKdtKey = (it: InventoryItem) =>
            `${(it.category || '').trim().toLowerCase()}|${(it.name || '').trim().toLowerCase()}|${(it.plating || '').trim().toLowerCase()}|${(it.spec || '').trim().toLowerCase()}`;
          const makeDefinitionKey = (it: InventoryItem) =>
            [it.name, it.plating, it.spec]
              .map((part) => String(part || '').trim().toLocaleLowerCase())
              .join('\u0000');
          const existingMap = new Map<string, InventoryItem>();
          inventory.forEach((item) => {
            existingMap.set(makeKdtKey(item), item);
          });
          const newImportDefinitionKeys = new Set(
            importedItems
              .filter((item) => !existingMap.has(makeKdtKey(item)))
              .map(makeDefinitionKey)
          );

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

          inventory.forEach((item) => {
            const category = (item.category || '').trim();
            if (category && !nextMasterData.categories.includes(category)) {
              nextMasterData.categories.push(category);
            }
          });

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

          const categories = nextMasterData.categories;
          const itemTemplates = new Map<string, InventoryItem>();
          importedItems.forEach((item) => {
            const templateKey = makeDefinitionKey(item);
            if (item.name.trim() && !itemTemplates.has(templateKey)) {
              itemTemplates.set(templateKey, item);
            }
          });

          const mergedItemsByKey = new Map<string, InventoryItem>(
            mergedInventory.map((item) => [makeKdtKey(item), item])
          );
          const today = new Date().toISOString().slice(0, 10);
          let sharedItemCount = 0;

          if (applyAcrossZones) for (const template of itemTemplates.values()) {
            // Do not use an opt-in import to normalize definitions that were only being updated.
            if (!newImportDefinitionKeys.has(makeDefinitionKey(template))) continue;
            const name = template.name.trim();
            if (!nextMasterData.nameOrder.includes(name)) {
              nextMasterData.nameOrder.push(name);
            }

            for (const category of categories) {
              const categoryNames = nextMasterData.namesByCategory[category] || [];
              if (!categoryNames.includes(name)) {
                nextMasterData.namesByCategory[category] = [...categoryNames, name];
              }

              const itemKey = makeKdtKey({ ...template, category });
              if (mergedItemsByKey.has(itemKey)) continue;

              const matchingZone = Object.values(nextMasterData.zoneMeta || {}).find(
                (zone) => zone.displayName === category
              );
              const zoneId = matchingZone?.zoneId || category;
              if (!matchingZone) {
                nextMasterData.zoneMeta![zoneId] = {
                  zoneId,
                  displayName: category,
                  aliasHistory: [],
                };
              }

              const sharedItem: InventoryItem = {
                ...template,
                id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                category,
                zoneId,
                currentStock: 0,
                safeStock: 0,
                location: '',
                supplier: '',
                lastUpdated: today,
                orderCategory: undefined,
                orderName: undefined,
              };
              mergedItemsByKey.set(itemKey, sharedItem);
              mergedInventory.push(sharedItem);
              sharedItemCount++;
            }
          }

          await Promise.all([
            api.migrateData({ inventory: mergedInventory, transactions }),
            api.saveMasterData(nextMasterData),
          ]);
          setInventory(mergedInventory);
          setMasterData(nextMasterData);

          const parts = [];
          if (addedCount > 0) parts.push(`신규 ${addedCount}건`);
          if (updatedCount > 0) parts.push(`업데이트 ${updatedCount}건`);
          if (sharedItemCount > 0) parts.push(`전체 대분류 보충 ${sharedItemCount}건`);
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

  const handleHistoryImport = async (
    importedTransactions: InventoryTransaction[],
    itemsToRegister: InventoryItem[] = [],
    applyAcrossZones = false
  ) => {
    if ((!importedTransactions || importedTransactions.length === 0) && itemsToRegister.length === 0) {
      setAlertModal({ title: '등록 오류', message: '저장할 데이터가 없습니다.' });
      return;
    }

    try {
      const currentTransactions = normalizeTransactions(await api.getTransactions());
      const initialInventory = await api.getInventory();
      const normalizeItemPart = (value?: string) =>
        String(value || '').replace(/\s+/g, '').trim().toLocaleLowerCase();
      const makeItemKey = (category: string, name: string, plating?: string, spec?: string) =>
        [category, name, plating, spec].map(normalizeItemPart).join('\u0000');

      const categories = Array.from(new Set([
        ...masterData.categories,
        ...initialInventory.map((item) => item.category),
        ...itemsToRegister.map((item) => item.category),
        ...importedTransactions.map((tx) => tx.category),
      ].filter(Boolean)));
      const nextMasterData: MasterData = {
        ...masterData,
        categories,
        namesByCategory: Object.fromEntries(
          Object.entries(masterData.namesByCategory).map(([category, names]) => [category, [...names]])
        ),
        nameOrder: [...masterData.nameOrder],
        zoneMeta: { ...(masterData.zoneMeta || {}) },
      };

      const inventoryByKey = new Map<string, InventoryItem>();
      initialInventory.forEach((item) => {
        const key = makeItemKey(item.category, item.name, item.plating, item.spec);
        if (!inventoryByKey.has(key)) inventoryByKey.set(key, item);
      });
      const latestInventory = [...initialInventory];
      const today = new Date().toISOString().slice(0, 10);
      const itemTemplates = new Map<string, InventoryItem>();
      itemsToRegister.forEach((item) => {
        const definitionKey = [item.name, item.plating, item.spec].map(normalizeItemPart).join('\u0000');
        const key = applyAcrossZones
          ? definitionKey
          : `${normalizeItemPart(item.category)}\u0000${definitionKey}`;
        if (!itemTemplates.has(key)) itemTemplates.set(key, item);
      });

      for (const template of itemTemplates.values()) {
        const name = template.name.trim();
        if (!name) continue;
        if (!nextMasterData.nameOrder.includes(name)) nextMasterData.nameOrder.push(name);

        const targetCategories = applyAcrossZones ? categories : [template.category];
        for (const category of targetCategories) {
          const categoryNames = nextMasterData.namesByCategory[category] || [];
          if (!categoryNames.includes(name)) {
            nextMasterData.namesByCategory[category] = [...categoryNames, name];
          }

          const itemKey = makeItemKey(category, name, template.plating, template.spec);
          if (inventoryByKey.has(itemKey)) continue;

          const matchingZone = Object.values(nextMasterData.zoneMeta || {}).find(
            (zone) => zone.displayName === category
          );
          const zoneId = matchingZone?.zoneId || category;
          if (!Object.values(nextMasterData.zoneMeta || {}).some((zone) => zone.displayName === category)) {
            nextMasterData.zoneMeta![zoneId] = {
              zoneId,
              displayName: category,
              aliasHistory: [],
            };
          }

          const isOriginalZone = category === template.category;
          const item: InventoryItem = {
            ...template,
            id:
              isOriginalZone && !initialInventory.some((existing) => existing.id === template.id)
                ? template.id
                : `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            category,
            zoneId,
            currentStock: isOriginalZone ? (Number(template.currentStock) || 0) : 0,
            safeStock: 0,
            location: '',
            supplier: '',
            lastUpdated: today,
            orderCategory: undefined,
            orderName: undefined,
          };
          inventoryByKey.set(itemKey, item);
          latestInventory.push(item);
        }
      }

      const resolvedTransactions = importedTransactions.map((tx) => {
        const item = inventoryByKey.get(makeItemKey(tx.category, tx.itemName, tx.plating, tx.spec));
        return item ? { ...tx, itemId: item.id, zoneId: item.zoneId || item.category } : tx;
      });
      const recalculatedItemIds = new Set(resolvedTransactions.map((tx) => tx.itemId));

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

      for (const tx of resolvedTransactions) {
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
          <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            수불 이력이 포함된 품목 {recalculatedItemIds.size.toLocaleString()}개의 재고는 이력 합계로 재산정됩니다.
          </div>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <li>신규 품목 생성: {(latestInventory.length - initialInventory.length).toLocaleString()}개</li>
            {applyAcrossZones && (
              <li>확대 적용 범위: 전체 {categories.length.toLocaleString()}개 대분류</li>
            )}
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

                // masterData 기반 정렬 보존
                const catMap = new Map<string, number>();
                nextMasterData.categories.forEach((c, i) => catMap.set(c, i));
                const nameMap = new Map<string, Map<string, number>>();
                Object.entries(nextMasterData.namesByCategory).forEach(([c, names]) => {
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
                const calculatedStock = new Map<string, number>(
                  latestInventory.map((item) => [item.id, Number(item.currentStock) || 0])
                );
                const transactionsByItemId = new Map<string, InventoryTransaction[]>();
                finalTransactions.forEach((tx) => {
                  if (!recalculatedItemIds.has(tx.itemId) || !calculatedStock.has(tx.itemId)) return;
                  const itemTransactions = transactionsByItemId.get(tx.itemId) || [];
                  itemTransactions.push(tx);
                  transactionsByItemId.set(tx.itemId, itemTransactions);
                });
                recalculatedItemIds.forEach((itemId) => {
                  const itemTransactions = transactionsByItemId.get(itemId) || [];
                  const latestCarryOver = itemTransactions
                    .filter((tx) => isCarryOverReason(tx.reason))
                    .sort((a, b) => b.date.localeCompare(a.date))[0];
                  const stockAfterLatestCarryOver = latestCarryOver
                    ? Math.round(Number(latestCarryOver.quantity) || 0)
                    : 0;
                  const movements = itemTransactions.filter(
                    (tx) =>
                      !isCarryOverReason(tx.reason) &&
                      (!latestCarryOver || tx.date >= latestCarryOver.date)
                  );
                  const stockFromHistory = movements.reduce((stock, tx) => {
                    const qty = Math.round(Number(tx.quantity) || 0);
                    return stock + (tx.type === 'IN' ? qty : -qty);
                  }, stockAfterLatestCarryOver);
                  calculatedStock.set(itemId, stockFromHistory);
                });

                const finalInventory = latestInventory.map((item) => ({
                  ...item,
                  currentStock: calculatedStock.get(item.id) ?? (Number(item.currentStock) || 0),
                }));

                await Promise.all([
                  api.migrateData({ inventory: finalInventory, transactions: finalTransactions }),
                  api.saveMasterData(nextMasterData),
                ]);
                setInventory(finalInventory);
                setMasterData(nextMasterData);

                let msg = `검증 및 등록 완료\n`;
                if (latestInventory.length > initialInventory.length) {
                  msg += `- 전체 대분류 품목 보충: ${latestInventory.length - initialInventory.length}개\n`;
                }
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
      await runWithProgress(
        'DB 전체 복구',
        makeProgressMsg('품목·수불 거래·기준정보를 서버에 복구하고 있습니다.'),
        async () => {
          const result = await api.migrateData(data);
          if (
            result.inventoryCount !== data.inventory.length ||
            result.transactionCount !== data.transactions.length
          ) {
            throw new Error(
              `복구 건수 불일치 (품목 ${result.inventoryCount}/${data.inventory.length}, 거래 ${result.transactionCount}/${data.transactions.length})`
            );
          }
          setInventory(data.inventory);
          setTransactions(data.transactions);
          if (data.masterData) setMasterData(data.masterData);
          setCurrentView('INVENTORY');
          setSuccessMessage(
            `DB 복구 완료: 품목 ${data.inventory.length.toLocaleString()}건, 수불 거래 ${data.transactions.length.toLocaleString()}건`
          );
          setShowSuccessModal(true);
          ActionLogger.log('System Restore Completed', {
            inventoryCount: data.inventory.length,
            transactionCount: data.transactions.length,
          });
        },
        setProgressModal
      );
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
