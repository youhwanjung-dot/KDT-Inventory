import React, { useRef, useState } from 'react';
import { X, Download, Upload, History, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { InventoryItem, InventoryTransaction, MasterData } from '../types';
import { ActionLogger } from '../utils/logger';
import { APP_VERSION } from '../constants';
import ConfirmationModal from './ConfirmationModal';

import { PDF_VERIFIED_INVENTORY, PDF_VERIFIED_TRANSACTIONS } from '../pdfVerifiedSeed';
import { formatItemDisplayKey } from '../utils/formatters';

interface DataMigrationModalProps {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  masterData: MasterData;
  onImport: (data: { inventory: InventoryItem[], transactions: InventoryTransaction[], masterData?: MasterData }) => void;
  onClose: () => void;
}

const DataMigrationModal: React.FC<DataMigrationModalProps> = ({ items, transactions, masterData, onImport, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // State for rollback confirmation modal
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{ inventory: InventoryItem[], transactions: InventoryTransaction[], masterData?: MasterData } | null>(null);

  const handleLoadKdtInitialSeed = () => {
    const categories = ['ZONE16_Plus', 'ZONE18'];
    const namesByCategory: Record<string, string[]> = {
      ZONE16_Plus: PDF_VERIFIED_INVENTORY.filter(i => i.category === 'ZONE16_Plus').map(formatItemDisplayKey),
      ZONE18: PDF_VERIFIED_INVENTORY.filter(i => i.category === 'ZONE18').map(formatItemDisplayKey),
    };
    const seedMaster: MasterData = {
      categories,
      namesByCategory,
      nameOrder: Array.from(new Set(PDF_VERIFIED_INVENTORY.map(formatItemDisplayKey))),
      zoneMeta: {
        ZONE16_Plus: { zoneId: 'ZONE16_Plus', displayName: 'ZONE16_Plus', aliasHistory: [] },
        ZONE18: { zoneId: 'ZONE18', displayName: 'ZONE18', aliasHistory: [] }
      }
    };
    setSelectedFileName('PDF 기준 초기 데이터 (ZONE16_Plus 10품목 + ZONE18 22품목 / 33입고건)');
    setPendingImportData({
      inventory: PDF_VERIFIED_INVENTORY,
      transactions: PDF_VERIFIED_TRANSACTIONS,
      masterData: seedMaster
    });
    setShowRollbackConfirm(true);
  };

  const handleExport = () => {
    try {
      const backupData = {
        version: APP_VERSION,
        date: new Date().toISOString(),
        inventory: items,
        transactions: transactions,
        // [CRITICAL] masterData 포함: 복원 시 ZONE/소분류 정렬 순서 및 zoneMeta 완벽 복구 보장
        masterData: {
          categories: masterData.categories,
          namesByCategory: masterData.namesByCategory,
          nameOrder: masterData.nameOrder,
          zoneMeta: masterData.zoneMeta || {},
        },
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      // Includes timestamp in filename for better version control
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.download = `KDT_통합백업_${dateStr}_v${APP_VERSION}.json`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ text: '재고 및 이력 데이터가 파일로 저장되었습니다.', type: 'success' });
      ActionLogger.log('Full DB Exported to File');
    } catch (e) {
      setMessage({ text: '파일 저장 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  const handleRollbackClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name); // Store filename for display
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const result = evt.target?.result as string;
        const parsedData = JSON.parse(result);
        
        let inventoryData: InventoryItem[] = [];
        let transactionData: InventoryTransaction[] = [];
        let masterDataFromFile: MasterData | undefined = undefined;

        // Determine format: Legacy (Array) or New (Object with keys)
        if (Array.isArray(parsedData)) {
          // Legacy format (Inventory Item Array only)
          inventoryData = parsedData;
          transactionData = []; 
        } else if (parsedData.inventory && Array.isArray(parsedData.inventory)) {
          // New format
          inventoryData = parsedData.inventory;
          transactionData = Array.isArray(parsedData.transactions) ? parsedData.transactions : [];
          // [CRITICAL] 백업 파일에 masterData가 포함된 경우 복원 시 정렬 순서 유지
          if (parsedData.masterData && Array.isArray(parsedData.masterData.categories)) {
            masterDataFromFile = parsedData.masterData as MasterData;
          }
        } else {
           throw new Error("Invalid format");
        }
        
        if (inventoryData.length > 0 && 'id' in inventoryData[0]) {
          setPendingImportData({ inventory: inventoryData, transactions: transactionData, masterData: masterDataFromFile });
          setShowRollbackConfirm(true); 
        } else {
          setMessage({ text: '올바르지 않은 백업 파일 형식입니다.', type: 'error' });
          setSelectedFileName(null);
          setPendingImportData(null);
        }
      } catch (err) {
        setMessage({ text: '파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 백업 파일인지 확인해주세요.', type: 'error' });
        setSelectedFileName(null);
        setPendingImportData(null);
      } finally {
        // Clear input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const executeRollback = () => {
    if (pendingImportData) {
      onImport(pendingImportData);
      setMessage({ text: '데이터가 성공적으로 롤백(복원)되었습니다.', type: 'success' });
      ActionLogger.log('DB Rollback Performed', { 
        items: pendingImportData.inventory.length, 
        transactions: pendingImportData.transactions.length 
      });
    }
    setShowRollbackConfirm(false);
    setSelectedFileName(null);
    setPendingImportData(null);
    setTimeout(onClose, 2000); 
  };

  const cancelRollbackConfirm = () => {
    setShowRollbackConfirm(false);
    setSelectedFileName(null);
    setPendingImportData(null);
    setMessage({ text: '데이터 복원이 취소되었습니다.', type: 'error' });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="text-orange-600 dark:text-orange-400" size={24} />
            시스템 백업 및 롤백
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-sm text-orange-900 dark:text-orange-300 flex items-start gap-3 border border-orange-100 dark:border-orange-800">
             <AlertTriangle size={20} className="shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
             <div>
               <p className="font-bold mb-1">통합 데이터 관리</p>
               <p>
                 <strong>[전체 백업]</strong> 시 현재 재고와 모든 입출고 이력이 하나의 파일로 저장됩니다.<br/>
                 복원 시 해당 시점의 데이터로 완전히 되돌아갑니다.
               </p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Backup Button */}
            <button 
              onClick={handleExport}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 dark:hover:border-orange-500 transition-all group"
            >
              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full group-hover:bg-orange-100 dark:group-hover:bg-orange-800 transition-colors">
                <Save size={24} className="text-slate-600 dark:text-slate-300 group-hover:text-orange-600 dark:group-hover:text-orange-300" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-slate-800 dark:text-slate-100">전체 백업 (Export)</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">재고+이력 다운로드</span>
              </div>
            </button>

            {/* Rollback Button */}
            <button 
              onClick={handleRollbackClick}
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:border-red-500 transition-all group"
            >
              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full group-hover:bg-red-100 dark:group-hover:bg-red-800 transition-colors">
                <Upload size={24} className="text-slate-600 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-300" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-red-700 dark:text-red-400">데이터 복원 (Import)</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">백업 파일 업로드</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
              />
            </button>
          </div>

          <button
            onClick={handleLoadKdtInitialSeed}
            className="w-full flex items-center justify-between gap-3 p-4 border-2 border-emerald-200 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl hover:border-emerald-500 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition-all"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 bg-emerald-600 text-white rounded-lg">
                <Download size={20} />
              </div>
              <div>
                <span className="block font-bold text-emerald-900 dark:text-emerald-200 text-sm">KDT 초기 입고 데이터 일괄 적재 (ZONE16_Plus / ZONE18)</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300">검증된 초기 32개 품목 + 33건 입고 이력 + ZONE 메타정보 즉시 적재</span>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shrink-0">즉시 적재</span>
          </button>

          {message && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-fade-in ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {message.text}
            </div>
          )}
        </div>
      </div>

      {showRollbackConfirm && (
        <ConfirmationModal
          title="데이터 복원 (경고)"
          message={
            <div className="space-y-2">
              <p className="font-bold text-red-600 dark:text-red-400">주의: 현재 데이터가 덮어씌워집니다!</p>
              <p>선택하신 백업 파일(<strong className="text-slate-800 dark:text-slate-100">{selectedFileName}</strong>)로 시스템을 복원합니다.</p>
              <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 mt-2">
                 <li>재고 품목: {pendingImportData?.inventory.length}개</li>
                 <li>입출고 이력: {pendingImportData?.transactions.length}건</li>
              </ul>
              <p className="mt-2">복원을 진행하시겠습니까?</p>
            </div>
          }
          confirmLabel="복원 실행"
          cancelLabel="취소"
          isDangerous={true}
          onConfirm={executeRollback}
          onCancel={cancelRollbackConfirm}
        />
      )}
    </div>
  );
};

export default DataMigrationModal;
