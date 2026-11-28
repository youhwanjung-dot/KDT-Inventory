import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Eye, Loader2, RotateCcw, X } from 'lucide-react';
import { InventoryItem, MasterData, User, ZoneArchiveData, ZoneArchiveSummary } from '../../types';
import { api } from '../../utils/api';
import ConfirmationModal from '../ConfirmationModal';
import { formatInteger } from '../../utils/formatters';

interface ZoneArchiveManagerModalProps {
  categories: string[];
  inventory: InventoryItem[];
  masterData: MasterData;
  currentUser: User;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

const formatArchivedAt = (value: any): string => {
  const date = value?._seconds ? new Date(value._seconds * 1000) : new Date(value || '');
  return Number.isNaN(date.getTime()) ? '시간 정보 없음' : date.toLocaleString('ko-KR');
};

const ZoneArchiveManagerModal: React.FC<ZoneArchiveManagerModalProps> = ({
  categories,
  inventory,
  masterData,
  currentUser,
  onClose,
  onCompleted,
}) => {
  const [archives, setArchives] = useState<ZoneArchiveSummary[]>([]);
  const [activeZone, setActiveZone] = useState(categories[0] || '');
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [archiveData, setArchiveData] = useState<ZoneArchiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'archive' | 'restore' | null>(null);

  const activeZoneId = useMemo(() => {
    const zoneMeta = Object.values(masterData.zoneMeta || {}).find((zone) => zone.displayName === activeZone);
    const item = inventory.find((candidate) => candidate.category === activeZone);
    return zoneMeta?.zoneId || item?.zoneId || activeZone;
  }, [activeZone, inventory, masterData.zoneMeta]);

  const loadArchives = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.getZoneArchives();
      setArchives(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const authPayload = () => ({
    userId: currentUser.id,
    token: localStorage.getItem('session_token') || '',
  });

  const runArchive = async () => {
    if (!activeZone || !activeZoneId) return;
    setIsProcessing(true);
    setError('');
    try {
      const result = await api.archiveZone({
        zoneId: activeZoneId,
        displayName: activeZone,
        ...authPayload(),
      });
      await loadArchives();
      setSelectedArchiveId(result.archiveId);
      setArchiveData(await api.getZoneArchive(result.archiveId));
      onCompleted(
        `${activeZone} 마감 완료: 품목 ${result.itemCount}개, 수불 ${result.transactionCount}건을 보관했습니다.`
      );
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : String(operationError));
    } finally {
      setIsProcessing(false);
      setConfirmation(null);
    }
  };

  const runRestore = async () => {
    if (!selectedArchiveId) return;
    setIsProcessing(true);
    setError('');
    try {
      const result = await api.restoreZoneArchive({
        archiveId: selectedArchiveId,
        ...authPayload(),
      });
      await loadArchives();
      setArchiveData(await api.getZoneArchive(selectedArchiveId));
      onCompleted(
        `${archiveData?.displayName || 'ZONE'} 복구 완료: 품목 ${result.itemCount}개, 수불 ${result.transactionCount}건을 활성 데이터로 복원했습니다.`
      );
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : String(operationError));
    } finally {
      setIsProcessing(false);
      setConfirmation(null);
    }
  };

  const loadArchive = async (archiveId: string) => {
    setSelectedArchiveId(archiveId);
    setArchiveData(null);
    setError('');
    try {
      setArchiveData(await api.getZoneArchive(archiveId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  return (
    <div className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Archive size={19} className="text-orange-600" /> ZONE 마감·보관함
            </h2>
            <p className="text-xs text-slate-500 mt-1">마감한 ZONE의 수불은 활성 DB에서 분리되어 읽기 전용으로 보관됩니다.</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-2 text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-0 flex-1">
          <aside className="p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">활성 ZONE 마감</label>
            <div className="flex gap-2">
              <select
                value={activeZone}
                onChange={(event) => setActiveZone(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-sm"
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <button
                type="button"
                disabled={!activeZone || isProcessing || currentUser.role !== 'admin'}
                onClick={() => setConfirmation('archive')}
                className="px-3 rounded-lg bg-orange-600 text-white text-sm font-bold disabled:opacity-50"
              >
                마감
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">현재고가 모두 0이고 거래 이력과 잔고가 일치해야 마감됩니다.</p>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">보관된 ZONE</h3>
              <button onClick={() => void loadArchives()} className="text-xs text-orange-600 hover:underline">새로고침</button>
            </div>
            {isLoading ? (
              <div className="py-6 flex justify-center text-slate-400"><Loader2 size={18} className="animate-spin" /></div>
            ) : archives.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">보관된 ZONE이 없습니다.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {archives.map((archive) => (
                  <button
                    key={archive.id}
                    onClick={() => void loadArchive(archive.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${
                      selectedArchiveId === archive.id
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{archive.displayName}</span>
                    <span className="block text-[11px] text-slate-500">
                      {archive.itemCount} 품목 · {archive.transactionCount} 수불 · {archive.status === 'RESTORED' ? '복구됨' : '보관 중'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="p-4 overflow-y-auto">
            {error && <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
            {!archiveData ? (
              <div className="h-full min-h-48 flex flex-col items-center justify-center text-slate-400 text-sm">
                <Eye size={24} className="mb-2" /> 보관 목록에서 ZONE을 선택하면 읽기 전용 이력이 표시됩니다.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{archiveData.displayName}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      마감 {formatArchivedAt(archiveData.archivedAt)} · 품목 {archiveData.itemCount}개 · 수불 {archiveData.transactionCount}건
                      {archiveData.orphanTransactionCount > 0 && ` · 고아 이력 ${archiveData.orphanTransactionCount}건 포함`}
                    </p>
                  </div>
                  {archiveData.status === 'ARCHIVED' && currentUser.role === 'admin' && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmation('restore')}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw size={15} /> 활성 DB로 복구
                    </button>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">마감 당시 품목 스냅샷</h4>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-auto max-h-40 mb-4">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2 text-left">품명</th><th className="p-2 text-left">도금</th>
                        <th className="p-2 text-left">규격</th><th className="p-2 text-left">위치</th>
                        <th className="p-2 text-right">마감재고(EA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archiveData.inventory.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{item.plating}</td>
                          <td className="p-2">{item.spec}</td>
                          <td className="p-2">{item.location}</td>
                          <td className="p-2 text-right">{formatInteger(item.currentStock)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">수불 이력 (읽기 전용)</h4>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2 text-left">일자</th><th className="p-2 text-left">유형</th>
                        <th className="p-2 text-left">품목</th><th className="p-2 text-right">수량(EA)</th>
                        <th className="p-2 text-right">잔고(EA)</th><th className="p-2 text-left">사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...archiveData.transactions]
                        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.id).localeCompare(String(b.id)))
                        .map((tx) => (
                          <tr key={tx.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="p-2 whitespace-nowrap">{tx.date}</td>
                            <td className={`p-2 font-bold ${tx.type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}>{tx.type === 'IN' ? '입고' : '출고'}</td>
                            <td className="p-2">{tx.itemName} <span className="text-slate-400">{[tx.plating, tx.spec].filter(Boolean).join(' / ')}</span></td>
                            <td className="p-2 text-right">{formatInteger(tx.quantity)}</td>
                            <td className="p-2 text-right">{formatInteger(tx.currentStockSnapshot)}</td>
                            <td className="p-2">{tx.reason}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {confirmation && (
        <ConfirmationModal
          title={confirmation === 'archive' ? 'ZONE 마감 확인' : 'ZONE 복구 확인'}
          message={confirmation === 'archive'
            ? `${activeZone}의 품목과 전체 수불 이력을 보관 전용 데이터로 옮기고 활성 목록에서 제거합니다. 현재고는 모두 0이어야 합니다.`
            : `${archiveData?.displayName || '선택한 ZONE'}의 보관 품목과 수불 이력을 활성 DB로 복원합니다.`}
          confirmLabel={confirmation === 'archive' ? '마감 및 보관' : '복구'}
          cancelLabel="취소"
          isDangerous
          onConfirm={() => void (confirmation === 'archive' ? runArchive() : runRestore())}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  );
};

export default ZoneArchiveManagerModal;
