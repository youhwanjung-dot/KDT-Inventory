import React, { useState, useMemo } from 'react';
import { X, ArrowRightLeft, RotateCcw, CheckSquare, Square, Loader2, AlertCircle } from 'lucide-react';
import { InventoryItem, InventoryTransaction, User } from '../../types';
import { formatInteger, roundToInt } from '../../utils/formatters';
import { api } from '../../utils/api';
import { ActionLogger } from '../../utils/logger';

interface ZoneSettlementModalProps {
  items: InventoryItem[];
  categories: string[];
  currentUser: User;
  initialZone?: string;
  onCompleted: (message: string) => void;
  onClose: () => void;
}

type SettlementMode = 'RETURN' | 'TRANSFER';

const ZoneSettlementModal: React.FC<ZoneSettlementModalProps> = ({
  items,
  categories,
  currentUser,
  initialZone,
  onCompleted,
  onClose,
}) => {
  const [sourceZone, setSourceZone] = useState<string>(initialZone || categories[0] || '');
  const [mode, setMode] = useState<SettlementMode>('RETURN');
  const [targetZone, setTargetZone] = useState<string>(
    categories.find((c) => c !== (initialZone || categories[0])) || ''
  );
  const [customTargetZone, setCustomTargetZone] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Items in sourceZone that currently have remaining stock > 0
  const zoneItemsWithStock = useMemo(() => {
    const list = items.filter((i) => i.category === sourceZone && roundToInt(i.currentStock, 0) > 0);
    return list;
  }, [items, sourceZone]);

  // Select all items with stock whenever sourceZone changes
  React.useEffect(() => {
    setSelectedIds(new Set(zoneItemsWithStock.map((i) => i.id)));
  }, [zoneItemsWithStock]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === zoneItemsWithStock.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(zoneItemsWithStock.map((i) => i.id)));
    }
  };

  const resolvedTargetZone = targetZone === '__NEW__' ? customTargetZone.trim() : targetZone.trim();

  const handleExecute = async () => {
    setError('');
    const targets = zoneItemsWithStock.filter((i) => selectedIds.has(i.id));
    if (targets.length === 0) {
      setError('정산할 자재를 1개 이상 선택해 주세요.');
      return;
    }
    if (mode === 'TRANSFER') {
      if (!resolvedTargetZone) {
        setError('이관 받을 대상 ZONE을 선택하거나 입력해 주세요.');
        return;
      }
      if (resolvedTargetZone === sourceZone) {
        setError('원본 ZONE과 이관 대상 ZONE이 동일할 수 없습니다.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      for (const srcItem of targets) {
        const qty = roundToInt(srcItem.currentStock, 0);
        if (qty <= 0) continue;

        // 1. Outbound settlement transaction from sourceZone
        const outReason =
          mode === 'RETURN'
            ? `[정산반납] ${sourceZone} 작업완료 잔여재고 반납`
            : `[재고이관] ${sourceZone} → ${resolvedTargetZone} 잔여재고 이관`;

        const outTx: InventoryTransaction = {
          id: `TX-SETTLE-OUT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: srcItem.id,
          itemName: srcItem.name,
          category: srcItem.category,
          zoneId: srcItem.zoneId || srcItem.category,
          plating: srcItem.plating || '',
          spec: srcItem.spec || '',
          date: settleDate,
          type: 'OUT',
          quantity: qty,
          worker: currentUser.name,
          department: '자재팀',
          reason: outReason,
          currentStockSnapshot: 0,
        };
        await api.saveTransaction(outTx);

        // 2. If TRANSFER mode, match or create item in targetZone and record inbound transaction
        if (mode === 'TRANSFER') {
          let dstItem = items.find(
            (i) =>
              i.category === resolvedTargetZone &&
              i.name.trim() === srcItem.name.trim() &&
              (i.plating || '').trim() === (srcItem.plating || '').trim() &&
              (i.spec || '').trim() === (srcItem.spec || '').trim()
          );

          let dstItemId = dstItem?.id;
          const nextStock = roundToInt(dstItem?.currentStock ?? 0, 0) + qty;

          if (!dstItem) {
            const newItem: InventoryItem = {
              ...srcItem,
              id: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              category: resolvedTargetZone,
              zoneId: resolvedTargetZone,
              currentStock: 0,
              lastUpdated: settleDate,
            };
            const saved = await api.saveItem(newItem);
            dstItemId = saved.id || newItem.id;
          }

          const inTx: InventoryTransaction = {
            id: `TX-SETTLE-IN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: dstItemId!,
            itemName: srcItem.name,
            category: resolvedTargetZone,
            zoneId: resolvedTargetZone,
            plating: srcItem.plating || '',
            spec: srcItem.spec || '',
            date: settleDate,
            type: 'IN',
            quantity: qty,
            worker: currentUser.name,
            department: '자재팀',
            reason: `[재고이관] ${sourceZone} 잔여재고 이관입고`,
            currentStockSnapshot: nextStock,
          };
          await api.saveTransaction(inTx);
        }
      }

      ActionLogger.log('ZONE Settlement Completed', {
        sourceZone,
        mode,
        targetZone: mode === 'TRANSFER' ? resolvedTargetZone : undefined,
        count: targets.length,
      });

      onCompleted(
        mode === 'RETURN'
          ? `${sourceZone} 잔여 자재 ${targets.length}종의 반납 정산(재고 0 마감)이 완료되었습니다.`
          : `${sourceZone} 잔여 자재 ${targets.length}종이 ${resolvedTargetZone}(으)로 이관 정산되었습니다.`
      );
      onClose();
    } catch (e: any) {
      setError('정산 처리 중 오류가 발생했습니다: ' + (e.message || String(e)));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-orange-600 dark:text-orange-400" />
              ZONE 작업완료 잔여재고 반납 · 이관 정산
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ZONE 작업 완료 후 남은 재고를 반납 정산(0 마감)하거나 다른 ZONE으로 이관하여 현장 혼입 재고를 정리합니다.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Settings Bar */}
        <div className="p-5 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">정산 대상 ZONE</label>
              <select
                value={sourceZone}
                onChange={(e) => setSourceZone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">정산 방식</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode('RETURN')}
                  className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                    mode === 'RETURN'
                      ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <RotateCcw size={13} /> 반납 (0 마감)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('TRANSFER')}
                  className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                    mode === 'TRANSFER'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ArrowRightLeft size={13} /> 타 ZONE 이관
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">정산 일자</label>
              <input
                type="date"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {mode === 'TRANSFER' && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">이관 받을 대상 ZONE:</span>
              <select
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
                className="px-3 py-1.5 text-sm font-bold border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">-- 대상 ZONE 선택 --</option>
                {categories
                  .filter((c) => c !== sourceZone)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                <option value="__NEW__">+ 신규 ZONE 직접 입력</option>
              </select>
              {targetZone === '__NEW__' && (
                <input
                  type="text"
                  value={customTargetZone}
                  onChange={(e) => setCustomTargetZone(e.target.value)}
                  placeholder="신규 ZONE명 (예: ZONE19)"
                  className="px-3 py-1.5 text-sm border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              )}
            </div>
          )}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
            <button onClick={toggleAll} className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-200">
              {selectedIds.size === zoneItemsWithStock.length && zoneItemsWithStock.length > 0 ? (
                <CheckSquare size={16} className="text-orange-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>전체 선택 ({selectedIds.size} / {zoneItemsWithStock.length}품목)</span>
            </button>
            <span>정산 대상 잔여수량 (EA)</span>
          </div>

          {zoneItemsWithStock.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              선택한 ZONE({sourceZone})에 잔여 재고가 있는 품목이 없습니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              {zoneItemsWithStock.map((item) => {
                const checked = selectedIds.has(item.id);
                const specBadge = [item.plating, item.spec].filter(Boolean).join(' / ');
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {checked ? (
                        <CheckSquare size={16} className="text-orange-600 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                      {specBadge && (
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {specBadge}
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-black text-sm text-orange-600 dark:text-orange-400">
                      {formatInteger(item.currentStock)} EA
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <span className="text-xs text-slate-500">
            * 정산 내역은 수불 이력에 자동 기록되어 언제든 추적이 가능합니다.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || selectedIds.size === 0}
              className={`px-5 py-2 text-sm font-bold text-white rounded-lg flex items-center gap-2 shadow disabled:opacity-50 ${
                mode === 'RETURN' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
              {mode === 'RETURN'
                ? `선택 ${selectedIds.size}종 반납 정산 실행`
                : `선택 ${selectedIds.size}종 이관 정산 실행`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneSettlementModal;
