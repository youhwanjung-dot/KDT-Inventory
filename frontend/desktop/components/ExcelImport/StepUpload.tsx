import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface StepUploadProps {
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StepUpload: React.FC<StepUploadProps> = ({ onFileUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
            <input
                type="file" aria-label="Excel Upload"
                accept=".xlsx, .xls"
                className="hidden"
                ref={fileInputRef}
                onChange={onFileUpload}
            />
            <div className="bg-white dark:bg-slate-700 p-4 rounded-full shadow-sm mb-4">
                <Upload size={32} className="text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">엑셀 파일 업로드</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm text-center">
                일반 목록형 또는 <strong>KDT 기존 재고양식</strong>을 지원합니다.<br />
                (잔량 열이 [수량]과 [단위]로 분리되어 있어도 자동으로 인식합니다)
            </p>
        </div>
    );
};

export default StepUpload;
