import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AnalysisResult } from './types';

interface AnalysisConfirmModalProps {
  analysis: AnalysisResult;
  onConfirm: () => void;
  onCancel: () => void;
}

const AnalysisConfirmModal: React.FC<AnalysisConfirmModalProps> = ({
  analysis,
  onConfirm,
  onCancel,
}) => {
  const isDanger = analysis.type === 'DELETE' || analysis.type === 'DELETE_SUBCATEGORY';

  const title =
    analysis.type === 'UPDATE'
      ? '기준정보 일괄 변경 확인'
      : analysis.type === 'MOVE_SUBCATEGORY'
      ? '품목 ZONE 이동 확인'
      : '기준정보 삭제 확인';

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div
          className={`px-5 py-4 border-b flex items-center gap-2 ${
            isDanger
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
              : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300'
          }`}
        >
          <AlertTriangle size={20} />
          <h3 className="font-bold">{title}</h3>
        </div>

        <div className="p-5 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          {analysis.type === 'UPDATE' && (
            <div className="flex items-center justify-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg font-bold">
              <span className="text-slate-500">{analysis.targetValue}</span>
              <ArrowRight size={16} className="text-orange-500" />
              <span className="text-orange-600 dark:text-orange-400">{analysis.newValue}</span>
            </div>
          )}

          {analysis.type === 'MOVE_SUBCATEGORY' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{analysis.targetValue}</div>
              <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                → 대상 ZONE: {analysis.newValue}
              </div>
            </div>
          )}

          {isDanger && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50 text-center">
              <span className="font-bold text-red-700 dark:text-red-300">{analysis.targetValue}</span> 항목을 삭제합니다.
            </div>
          )}

          <p>
            영향을 받는 자재 품목: <strong className="text-orange-600 dark:text-orange-400">{analysis.affectedCount}건</strong>
          </p>

          {analysis.affectedSample.length > 0 && (
            <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-1 max-h-32 overflow-y-auto">
              <div className="font-bold text-slate-500">영향 품목 미리보기:</div>
              {analysis.affectedSample.map((s, idx) => (
                <div key={idx} className="truncate">
                  • {s}
                </div>
              ))}
              {analysis.affectedCount > analysis.affectedSample.length && (
                <div className="text-slate-400">
                  ... 외 {analysis.affectedCount - analysis.affectedSample.length}건
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isDanger ? '삭제 실행' : '변경 적용'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisConfirmModal;
