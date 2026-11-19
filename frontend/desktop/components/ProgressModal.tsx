import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressModalProps {
  title: string;
  message: React.ReactNode;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ title, message }) => {
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b bg-slate-50 border-slate-100 dark:bg-slate-700/50 dark:border-slate-700">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
        </div>

        <div className="p-6 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          {message}
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;
