import React, { useState } from 'react';
import { Edit3, RotateCcw, Check, X, ArrowRight } from 'lucide-react';
import { FieldDef, FIELD_SETTINGS_KEY, DEFAULT_DB_FIELDS } from '../../constants';
import { FieldMapping } from './utils';
import ConfirmationModal from '../ConfirmationModal';

interface StepMappingProps {
    dbFields: FieldDef[];
    setDbFields: React.Dispatch<React.SetStateAction<FieldDef[]>>;
    mapping: FieldMapping;
    setMapping: React.Dispatch<React.SetStateAction<FieldMapping>>;
    excelHeaders: string[];
    onBack: () => void;
    onNext: () => void;
}

const StepMapping: React.FC<StepMappingProps> = ({
    dbFields, setDbFields, mapping, setMapping, excelHeaders, onBack, onNext
}) => {
    const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
    const [tempLabel, setTempLabel] = useState('');
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleMappingChange = (dbField: string, excelHeader: string) => {
        setMapping(prev => ({ ...prev, [dbField]: excelHeader }));
    };

    const startEditingLabel = (field: FieldDef) => {
        setEditingFieldKey(field.key);
        setTempLabel(field.label);
    };

    const saveLabelEdit = () => {
        if (editingFieldKey && tempLabel.trim()) {
            const newFields = dbFields.map(f =>
                f.key === editingFieldKey ? { ...f, label: tempLabel.trim() } : f
            );
            setDbFields(newFields);
            localStorage.setItem(FIELD_SETTINGS_KEY, JSON.stringify(newFields));
        }
        setEditingFieldKey(null);
    };

    const resetLabels = () => {
        setShowResetConfirm(true);
    };

    const cancelLabelEdit = () => {
        setEditingFieldKey(null);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg mb-6 flex items-start justify-between gap-3 border border-orange-100 dark:border-orange-800">
                <div className="flex gap-3">
                    <Edit3 size={20} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-800 dark:text-orange-300">
                        <p className="font-bold mb-1">DB 필드 매핑 & 명칭 설정</p>
                        <p>
                            KDT 데이터 형식과 순서가 일치하도록 엑셀 헤더를 연결해주세요.<br />
                            DB 필드명을 클릭하여 원하는 명칭(예: 거래처 → 사용부서)으로 영구 수정할 수 있습니다.
                        </p>
                    </div>
                </div>
                <button
                    onClick={resetLabels}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded shadow-sm"
                >
                    <RotateCcw size={12} /> 초기화
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden transition-colors">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <tr>
                            <th className="px-4 py-3 text-left w-1/3">KDT DB 필드 (클릭하여 수정)</th>
                            <th className="px-4 py-3 text-left w-2/3">엑셀 파일 열 (Header)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {dbFields.map((field) => (
                            <tr key={field.key}>
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 relative group">
                                    {editingFieldKey === field.key ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={tempLabel}
                                                onChange={(e) => setTempLabel(e.target.value)}
                                                className="w-full px-2 py-1 border border-orange-400 dark:border-orange-500 rounded focus:outline-none text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                                autoFocus
                                                title="필드 명칭 입력"
                                                placeholder="명칭 입력"
                                            />
                                            <button onClick={saveLabelEdit} className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300" title="저장" aria-label="저장"><Check size={16} /></button>
                                            <button onClick={cancelLabelEdit} className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" title="취소" aria-label="취소"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center cursor-pointer hover:text-orange-600 dark:hover:text-orange-400" onClick={() => startEditingLabel(field)} title="클릭하여 명칭 수정">
                                            <span className="truncate">{field.label}</span>
                                            <Edit3 size={14} className="text-slate-300 dark:text-slate-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            {field.required && <span className="text-red-500 ml-1 absolute right-2 top-3">*</span>}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <select
                                        className="w-full border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors"
                                        value={mapping[field.key] || ''}
                                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                        title={`${field.label} 매핑 선택`}
                                        aria-label={`${field.label} 매핑 선택`}
                                    >
                                        <option value="">(선택 안함)</option>
                                        {excelHeaders.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                <button onClick={onNext} className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg flex items-center gap-2">데이터 미리보기 <ArrowRight size={16} /></button>
                <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">뒤로가기</button>
            </div>
            {showResetConfirm && (
                <ConfirmationModal
                    title="필드 명칭 초기화"
                    message="필드 명칭을 기본값으로 초기화하시겠습니까?"
                    confirmLabel="초기화"
                    cancelLabel="취소"
                    isDangerous={true}
                    onConfirm={() => {
                        setDbFields(DEFAULT_DB_FIELDS);
                        localStorage.removeItem(FIELD_SETTINGS_KEY);
                        setShowResetConfirm(false);
                    }}
                    onCancel={() => setShowResetConfirm(false)}
                />
            )}
        </div>
    );
};

export default StepMapping;
