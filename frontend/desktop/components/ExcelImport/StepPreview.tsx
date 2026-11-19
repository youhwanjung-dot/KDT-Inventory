import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { InventoryItem } from '../../types';
import { FieldDef } from '../../constants';
import { formatStockWithUnit } from '../../utils/formatters';
import AnalysisModal from './AnalysisModal';

interface StepPreviewProps {
    previewItems: InventoryItem[];
    currentInventory: InventoryItem[];
    isLegacyMode: boolean;
    dbFields: FieldDef[];
    onConfirm: () => void;
    onBack: () => void;
}

const StepPreview: React.FC<StepPreviewProps> = ({
    previewItems, currentInventory, isLegacyMode, dbFields, onConfirm, onBack
}) => {
    const [showAnalysis, setShowAnalysis] = useState(false);

    const getLabel = (key: string, fallback: string) => dbFields.find(f => f.key === key)?.label || fallback;

    const handleAnalyzeAndConfirm = () => {
        setShowAnalysis(true);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                    {isLegacyMode ? (
                        <span className="flex items-center gap-2 text-orange-600 font-bold">
                            <CheckCircle size={16} /> KDT 엑셀 양식(입고시트 / 현 재고)이 감지되어 자동으로 변환되었습니다. (총 {previewItems.length}건)
                        </span>
                    ) : (
                        <span>총 <span className="font-bold text-orange-600 dark:text-orange-400">{previewItems.length}</span>개의 데이터가 변환되었습니다.</span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-3 py-2 border-b dark:border-slate-700">{getLabel('category', 'ZONE (대분류)')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700">{getLabel('name', '품명 (소분류)')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700">{getLabel('plating', '도금')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700">{getLabel('spec', '규격')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700 font-bold bg-slate-100 dark:bg-slate-700/50 text-right">{getLabel('currentStock', '현재고(EA)')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700 text-center">{getLabel('unit', '단위')}</th>
                            <th className="px-3 py-2 border-b dark:border-slate-700">{getLabel('note', '비고')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {previewItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-slate-700 dark:text-slate-300">
                                <td className="p-2 font-semibold">{item.category}</td>
                                <td className="p-2">{item.name}</td>
                                <td className="p-2 text-center text-xs">{item.plating || '-'}</td>
                                <td className="p-2 text-center text-xs">{item.spec || '-'}</td>
                                <td className="p-2 text-right font-bold text-orange-600">{formatStockWithUnit(item.currentStock, item.unit, item.eaPerUnit)}</td>
                                <td className="p-2 text-center">{item.unit}</td>
                                <td className="p-2 text-xs text-slate-500">{item.note || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={handleAnalyzeAndConfirm}
                    className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg flex items-center gap-2"
                >
                    <CheckCircle size={18} />
                    분석 및 등록
                </button>
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
                >
                    {isLegacyMode ? '처음으로' : '매핑 다시하기'}
                </button>
            </div>

            {showAnalysis && (
                <AnalysisModal
                    previewItems={previewItems}
                    currentInventory={currentInventory}
                    onConfirm={onConfirm}
                    onCancel={() => setShowAnalysis(false)}
                />
            )}
        </div>
    );
};

export default StepPreview;
