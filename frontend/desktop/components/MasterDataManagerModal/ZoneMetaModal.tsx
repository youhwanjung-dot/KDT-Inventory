import React, { useState } from 'react';
import { X, Save, History, Factory, Tag } from 'lucide-react';
import { ZoneMeta } from '../../types';

interface ZoneMetaModalProps {
  zoneName: string;
  initialMeta: ZoneMeta;
  existingNames: string[];
  onSave: (oldName: string, updatedMeta: ZoneMeta) => void;
  onClose: () => void;
}

const ZoneMetaModal: React.FC<ZoneMetaModalProps> = ({
  zoneName,
  initialMeta,
  existingNames,
  onSave,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState(initialMeta.displayName || zoneName);
  const [customer, setCustomer] = useState(initialMeta.customer || '');
  const [plannedQty, setPlannedQty] = useState<string>(
    initialMeta.plannedProductionQty ? String(initialMeta.plannedProductionQty) : ''
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('ZONE 표시명은 필수입니다.');
      return;
    }
    if (trimmed !== zoneName && existingNames.includes(trimmed)) {
      setError('이미 동일한 ZONE 명칭이 존재합니다.');
      return;
    }

    const nextHistory = [...(initialMeta.aliasHistory || [])];
    if (trimmed !== zoneName) {
      nextHistory.unshift({
        name: zoneName,
        changedAt: new Date().toISOString().slice(0, 10),
        customer: initialMeta.customer || undefined,
      });
    }

    const updated: ZoneMeta = {
      ...initialMeta,
      zoneId: initialMeta.zoneId,
      displayName: trimmed,
      customer: customer.trim() || undefined,
      plannedProductionQty: plannedQty ? Math.max(0, Math.round(Number(plannedQty) || 0)) : undefined,
      aliasHistory: nextHistory,
    };
    onSave(zoneName, updated);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-orange-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">ZONE 별칭 · 생산 기준 설정</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 flex justify-between">
            <span>불변 ZONE ID (이력 보존 키)</span>
            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{initialMeta.zoneId}</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
              ZONE 표시명 (별칭 변경 가능 — 예: ZONE18 → Fluid18)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 text-sm font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
              required
            />
            {displayName.trim() !== zoneName && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                표시명 변경 시 기존 이름({zoneName})은 별칭 이력에 기록되며 소속 자재와 이력이 자동 동기화됩니다.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">고객사명 (선택)</label>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="예: KDT / 고객사 A"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Factory size={12} className="text-orange-500" />
                목표 생산수량 (2차 선반영)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={plannedQty}
                onChange={(e) => setPlannedQty(e.target.value)}
                placeholder="예: 9600"
                className="w-full px-3 py-2 text-sm text-right font-mono border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {initialMeta.aliasHistory && initialMeta.aliasHistory.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <History size={13} /> 과거 별칭 변경 이력
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {initialMeta.aliasHistory.map((h, i) => (
                  <div
                    key={`${h.name}-${i}`}
                    className="flex justify-between text-xs px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                  >
                    <span className="font-semibold">{h.name}</span>
                    <span className="font-mono text-slate-400">{h.changedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow"
            >
              <Save size={15} /> 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ZoneMetaModal;
