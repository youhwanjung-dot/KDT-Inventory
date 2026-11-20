import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { InventoryItem } from '../../types';

interface AnalysisModalProps {
    previewItems: InventoryItem[];
    currentInventory: InventoryItem[];
    onConfirm: (applyAcrossZones: boolean) => void;
    onCancel: () => void;
}

const makeKdtKey = (it: InventoryItem) =>
    `${(it.category || '').trim().toLowerCase()}|${(it.name || '').trim().toLowerCase()}|${(it.plating || '').trim().toLowerCase()}|${(it.spec || '').trim().toLowerCase()}`;

const AnalysisModal: React.FC<AnalysisModalProps> = ({ previewItems, currentInventory, onConfirm, onCancel }) => {
    const [applyAcrossZones, setApplyAcrossZones] = useState(false);
    const existingKeys = new Set(currentInventory.map(makeKdtKey));
    const duplicateCount = previewItems.filter(p => existingKeys.has(makeKdtKey(p))).length;
    const newItemCount = previewItems.length - duplicateCount;

    return (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 border-b border-orange-100 dark:border-orange-900/50 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full text-orange-600 dark:text-orange-400">
                        <CheckCircle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">데이터 등록 분석</h3>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-slate-600 dark:text-slate-300">
                        총 <strong className="text-orange-600 dark:text-orange-400">{previewItems.length}</strong>건의 자재 데이터를 등록합니다.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <li className="flex justify-between">
                                <span>신규 등록 예정:</span>
                                <span className="font-bold">{previewItems.length - duplicateCount}건</span>
                            </li>
                            <li className="flex justify-between text-orange-600 dark:text-orange-400">
                                <span>기존 항목 업데이트 (ZONE+품명+도금+규격 일치):</span>
                                <span className="font-bold">{duplicateCount}건</span>
                            </li>
                        </ul>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        * ZONE + 품명 + 도금 + 규격이 동일한 기존 자재는 현재고 및 정보가 업데이트됩니다.<br />
                        * [확인 및 등록] 시 DB에 즉시 반영됩니다.
                    </p>
                    {newItemCount > 0 && (
                        <label className="flex items-start gap-2 rounded-lg border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/20 p-3 text-sm text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={applyAcrossZones}
                                onChange={(event) => setApplyAcrossZones(event.target.checked)}
                                className="mt-0.5 accent-orange-600"
                            />
                            <span>
                                신규 품목 정의를 전체 대분류에 확대 적용
                                <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    선택하지 않으면 파일에 지정된 ZONE에만 등록합니다. 확대 적용 시 누락된 ZONE에만 현재고 0으로 추가하며, 기존 품목과 재고는 변경하지 않습니다.
                                </span>
                            </span>
                        </label>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={() => onConfirm(applyAcrossZones)}
                        className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-sm font-bold shadow-md transition-colors"
                    >
                        확인 및 등록
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
