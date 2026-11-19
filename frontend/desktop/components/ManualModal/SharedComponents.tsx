import React from 'react';
import { APP_VERSION } from '../../constants';

export const ManualPage: React.FC<{ pageNumber: number, totalPages: number, children: React.ReactNode }> = ({ pageNumber, totalPages, children }) => (
    <div className={`report-page print-page w-[210mm] max-w-[210mm] h-[297mm] max-h-[297mm] bg-white text-slate-800 shadow-md px-8 py-6 flex flex-col justify-between relative box-border overflow-hidden ${pageNumber === totalPages ? 'break-after-avoid' : 'break-after-page'}`}>
        <div className="flex-1 flex flex-col justify-start space-y-3 overflow-hidden min-h-0">{children}</div>
        <footer className="mt-4 pt-2.5 border-t border-slate-200 text-center text-[9.5px] text-slate-400 shrink-0 h-9 flex flex-col justify-center">
            <p>아산노블요양원 통합 재고관리 시스템 Ver {APP_VERSION} &copy; 2026</p>
            <p className="font-bold mt-0.5">Page {pageNumber} / {totalPages}</p>
        </footer>
    </div>
);

export const H1: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <h1 className={`text-lg font-extrabold text-slate-900 mb-2 pb-1.5 border-b-2 border-slate-800 tracking-tight shrink-0 ${className}`}>{children}</h1>
);

export const H2: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <h2 className={`text-sm font-bold text-blue-800 mt-2 mb-2 pb-1 border-b border-blue-200 tracking-tight shrink-0 ${className}`}>{children}</h2>
);

export const H3: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <h3 className={`text-xs font-bold text-slate-800 mt-2 mb-1 shrink-0 ${className}`}>{children}</h3>
);

export const P: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <p className={`mb-2 leading-[1.6] text-[11.5px] text-slate-700 shrink-0 ${className}`}>{children}</p>
);

export const Li: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <li className={`mb-1.5 text-[11.5px] leading-[1.6] text-slate-700 ${className}`}>{children}</li>
);

export const Code: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-block font-bold text-slate-800 bg-slate-100 px-1 py-0.2 rounded text-[10px] border border-slate-300 mx-0.5 align-baseline leading-none shadow-2xs ${className}`}>
        {children}
    </span>
);

export const Snapshot: React.FC<{ children: React.ReactNode, caption?: string }> = ({ children, caption }) => (
    <div className="my-1.5 p-2 border border-slate-200 bg-slate-50/70 rounded-lg overflow-hidden shrink-0 flex flex-col justify-center">
        {children}
        {caption && <p className="text-center text-[9px] text-slate-500 font-medium mt-1 shrink-0">{caption}</p>}
    </div>
);

export const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="p-2 bg-blue-50/90 border-l-4 border-blue-500 text-blue-900 my-1 text-[11px] rounded-r-lg leading-normal shadow-2xs shrink-0">
        {children}
    </div>
);

export const Warning: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="p-2 bg-amber-50/90 border-l-4 border-amber-500 text-amber-900 my-1 text-[11px] rounded-r-lg leading-normal shadow-2xs shrink-0">
        {children}
    </div>
);
