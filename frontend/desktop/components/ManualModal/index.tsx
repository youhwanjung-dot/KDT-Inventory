import React, { useRef } from 'react';
import { X, Printer, BookOpen } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import UserManual from './UserManual';
import { User } from '../../types';
import { APP_VERSION } from '../../constants';

interface ManualModalProps {
    user?: User;
    onClose: () => void;
}

const ManualModal: React.FC<ManualModalProps> = ({ user, onClose }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const isAdmin = user?.role === 'admin';

    const handlePrint = useReactToPrint({
        contentRef: contentRef,
        documentTitle: isAdmin
            ? `KDT_시스템_관리자매뉴얼_v${APP_VERSION}`
            : `KDT_시스템_사용자매뉴얼_v${APP_VERSION}`,
        pageStyle: `
            @page {
                size: A4 portrait;
                margin: 8mm;
            }
            body {
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        `,
    });

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex flex-col items-center p-0 animate-fade-in print-modal-overlay">
            {/* Header Controls */}
            <div className="w-full bg-white dark:bg-slate-900 flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shrink-0 no-print">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200">
                        <BookOpen size={16} className="text-emerald-500" />
                        <span>
                            {isAdmin ? '시스템 매뉴얼 (관리자용 - 전체 5페이지)' : '시스템 매뉴얼 (일반 사용자용 - 전체 4페이지)'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handlePrint()}
                        className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-colors cursor-pointer"
                    >
                        <Printer size={16} /> 매뉴얼 인쇄 (PDF 저장)
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                        aria-label="닫기"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="w-full flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-100 dark:bg-slate-950">
                <div ref={contentRef} className="flex flex-col items-center gap-8">
                    <UserManual userRole={user?.role} />
                </div>
            </div>
        </div>
    );
};

export default ManualModal;
