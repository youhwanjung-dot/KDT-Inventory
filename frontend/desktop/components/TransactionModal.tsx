import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  Calendar,
  User,
  Building,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  Trash2,
  PlusCircle,
  Search,
  AlertTriangle,
  RotateCcw,
  Lock,
  Calculator,
} from 'lucide-react';
import { InventoryItem, InventoryTransaction, TxPermission, User as UserType } from '../types';
import { USER_DEPARTMENTS } from '../constants';
import { formatInteger, formatStockWithUnit, roundToInt } from '../utils/formatters';
import ConfirmationModal from './ConfirmationModal';

interface TransactionModalProps {
  item: InventoryItem;
  transactions?: InventoryTransaction[];
  currentUser: UserType;
  users: UserType[];
  onSave: (transaction: Omit<InventoryTransaction, 'id' | 'currentStockSnapshot'>) => void;
  onUpdate: (oldTx: InventoryTransaction, newTxData: Partial<InventoryTransaction>) => void;
  onDelete: (tx: InventoryTransaction) => void;
  onClose: () => void;
}

const DEPARTMENTS: string[] = [...USER_DEPARTMENTS];
const REASONS_IN = ['자재입고', '추가입고', '반품입고', '직접입력'];
const REASONS_OUT = ['라인불출', '추가불출', '불량교체', '직접입력'];

const resolveTxPermission = (u: UserType): TxPermission => {
  if (u.role === 'admin') return 'ALL';
  return u.txPermission || 'OUT_ONLY';
};

const getDefaultDepartmentByWorker = (workerName: string, userList: UserType[]): string => {
  return userList.find((user) => user.name === workerName)?.department || '제조팀';
};

const TransactionModal: React.FC<TransactionModalProps> = ({
  item,
  transactions = [],
  currentUser,
  users,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const permission = resolveTxPermission(currentUser);
  const canIn = permission === 'ALL' || permission === 'IN_ONLY';
  const canOut = permission === 'ALL' || permission === 'OUT_ONLY';
  const defaultType: 'IN' | 'OUT' = canIn && !canOut ? 'IN' : 'OUT';

  const [editingTx, setEditingTx] = useState<InventoryTransaction | null>(null);

  // Form State
  const [type, setType] = useState<'IN' | 'OUT'>(defaultType);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('1');
  const [packCalcInput, setPackCalcInput] = useState<string>('');

  const [worker, setWorker] = useState(currentUser.name);
  const [department, setDepartment] = useState(getDefaultDepartmentByWorker(currentUser.name, users));
  const [customDepartment, setCustomDepartment] = useState('');

  const [reason, setReason] = useState(defaultType === 'IN' ? REASONS_IN[0] : REASONS_OUT[0]);
  const [customReason, setCustomReason] = useState('');

  // History View State
  const [historyView, setHistoryView] = useState<'month' | 'year' | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<InventoryTransaction | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  const hasUnitConversion = (item.eaPerUnit ?? 1) > 1 && item.unit && item.unit.toUpperCase() !== 'EA';

  // Compute exact running stock (integer EA) backwards from currentStock
  const itemTransactionsWithStock = useMemo(() => {
    const sorted = transactions
      .filter((t) => t.itemId === item.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    const runningStock = roundToInt(item.currentStock, 0);
    const stockAfter: number[] = new Array(sorted.length).fill(0);
    let rolling = runningStock;
    for (let i = sorted.length - 1; i >= 0; i--) {
      stockAfter[i] = rolling;
      const qty = roundToInt(sorted[i].quantity, 0);
      const delta = sorted[i].type === 'IN' ? qty : -qty;
      rolling = rolling - delta;
    }

    return sorted
      .map((tx, i) => ({
        ...tx,
        computedStock: stockAfter[i],
      }))
      .reverse();
  }, [transactions, item.id, item.currentStock]);

  const filteredTransactions = useMemo(() => {
    if (historyView === 'all') {
      return itemTransactionsWithStock;
    } else if (historyView === 'year') {
      const selectedYear = (date ? new Date(date) : new Date()).getFullYear();
      return itemTransactionsWithStock.filter((tx) => new Date(tx.date).getFullYear() === selectedYear);
    } else {
      const targetDate = date ? new Date(date) : new Date();
      const targetMonth = targetDate.toISOString().slice(0, 7);
      return itemTransactionsWithStock.filter((tx) => tx.date.startsWith(targetMonth));
    }
  }, [itemTransactionsWithStock, historyView, date]);

  const resetForm = () => {
    setType(defaultType);
    setDate(new Date().toISOString().split('T')[0]);
    setQuantity('1');
    setPackCalcInput('');
    setWorker(currentUser.name);
    setDepartment(getDefaultDepartmentByWorker(currentUser.name, users));
    setReason(defaultType === 'IN' ? REASONS_IN[0] : REASONS_OUT[0]);
    setCustomDepartment('');
    setCustomReason('');
    setEditingTx(null);
  };

  useEffect(() => {
    resetForm();
    setHistoryView('all');
  }, [item, currentUser.id, currentUser.txPermission, currentUser.department, users]);

  const handleTypeChange = (newType: 'IN' | 'OUT') => {
    if (newType === 'IN' && !canIn) return;
    if (newType === 'OUT' && !canOut) return;
    setType(newType);
    if (!editingTx) {
      setReason(newType === 'IN' ? REASONS_IN[0] : REASONS_OUT[0]);
    }
  };

  const handlePackCalcChange = (val: string) => {
    setPackCalcInput(val);
    const num = parseFloat(val);
    const factor = Math.max(1, roundToInt(item.eaPerUnit, 1));
    if (!Number.isNaN(num) && num > 0) {
      setQuantity(String(Math.round(num * factor)));
    }
  };

  const handleWorkerChange = (workerName: string) => {
    setWorker(workerName);
    setDepartment(getDefaultDepartmentByWorker(workerName, users));
    setCustomDepartment('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'IN' && !canIn) {
      setAlertModal({ title: '권한 제한', message: '현재 계정은 입고 권한이 없습니다.' });
      return;
    }
    if (type === 'OUT' && !canOut) {
      setAlertModal({ title: '권한 제한', message: '현재 계정은 출고 권한이 없습니다.' });
      return;
    }

    const intQty = roundToInt(quantity, 0);
    if (intQty <= 0) {
      setAlertModal({ title: '입력 오류', message: '수량은 1 EA 이상 정수여야 합니다.' });
      return;
    }

    const txData = {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      zoneId: item.zoneId || item.category,
      plating: item.plating || '',
      spec: item.spec || '',
      date,
      type,
      quantity: intQty,
      worker,
      department: department === '기타부서' ? customDepartment : department,
      reason: reason === '직접입력' ? customReason : reason,
    };

    if (editingTx) {
      onUpdate(editingTx, txData);
    } else {
      onSave(txData);
    }

    resetForm();
  };

  const handleStartEdit = (tx: InventoryTransaction) => {
    if (tx.type === 'IN' && !canIn) {
      setAlertModal({ title: '권한 제한', message: '출고 담당 계정은 입고 이력을 수정/삭제할 수 없습니다.' });
      return;
    }
    if (tx.type === 'OUT' && !canOut) {
      setAlertModal({ title: '권한 제한', message: '입고 담당 계정은 출고 이력을 수정/삭제할 수 없습니다.' });
      return;
    }

    setEditingTx(tx);
    setType(tx.type);
    setDate(tx.date);
    setQuantity(String(roundToInt(tx.quantity, 0)));
    setPackCalcInput('');
    setWorker(tx.worker);

    if (DEPARTMENTS.includes(tx.department)) {
      setDepartment(tx.department);
      setCustomDepartment('');
    } else {
      setDepartment('기타부서');
      setCustomDepartment(tx.department || '');
    }

    const reasons = tx.type === 'IN' ? REASONS_IN : REASONS_OUT;
    if (reasons.includes(tx.reason)) {
      setReason(tx.reason);
      setCustomReason('');
    } else {
      setReason('직접입력');
      setCustomReason(tx.reason || '');
    }
  };

  const handleDeleteRequest = () => {
    if (editingTx) {
      setDeleteTarget(editingTx);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
      resetForm();
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentVal = roundToInt(quantity, 0);
      const adjustment = e.key === 'ArrowUp' ? 1 : -1;
      const newVal = Math.max(1, currentVal + adjustment);
      setQuantity(String(newVal));
    }
  };

  const specBadge = [item.plating, item.spec].filter(Boolean).join(' / ');
  const inputClass =
    'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors';
  const selectClass = `${inputClass} appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] pr-8`;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-[1180px] xl:max-w-[1240px] flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="text-orange-600 dark:text-orange-400" size={22} />
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">입출고 관리 및 이력</h2>
              {permission === 'IN_ONLY' && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                  입고 담당 모드
                </span>
              )}
              {permission === 'OUT_ONLY' && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  출고 담당 모드
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center gap-2">
              <span className="font-bold text-orange-600 dark:text-orange-400">{item.category}</span>
              <span>&gt;</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">{item.name}</span>
              {specBadge && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {specBadge}
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span>
                현재고:{' '}
                <span className="text-orange-600 dark:text-orange-400 font-bold text-base">
                  {formatStockWithUnit(item.currentStock, item.unit, item.eaPerUnit)}
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-white dark:bg-slate-800 p-1 rounded-full border border-transparent hover:border-slate-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body Layout: 2 Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Form */}
          <div className="w-[460px] xl:w-[500px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-6 space-y-5">
              {/* Section Title */}
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  editingTx ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'
                }`}
              >
                {editingTx ? <AlertTriangle size={18} /> : <PlusCircle size={18} />}
                <span>{editingTx ? '내역 수정 및 삭제' : '신규 수불 등록'}</span>
              </div>

              {/* Type Toggle (Permission-aware IN / OUT) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!canIn}
                  onClick={() => handleTypeChange('IN')}
                  title={!canIn ? '출고 담당 계정은 입고 메뉴가 비활성화됩니다.' : '자재 입고 등록'}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold transition-all ${
                    !canIn
                      ? 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60'
                      : type === 'IN'
                      ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 shadow-sm ring-1 ring-orange-500'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {!canIn ? <Lock size={16} /> : <ArrowUpCircle size={20} />}
                  <span>입고 {!canIn && '(비활성)'}</span>
                </button>
                <button
                  type="button"
                  disabled={!canOut}
                  onClick={() => handleTypeChange('OUT')}
                  title={!canOut ? '입고 담당 계정은 출고 메뉴가 비활성화됩니다.' : '자재 출고(불출) 등록'}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold transition-all ${
                    !canOut
                      ? 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60'
                      : type === 'OUT'
                      ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 shadow-sm ring-1 ring-red-500'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {!canOut ? <Lock size={16} /> : <ArrowDownCircle size={20} />}
                  <span>출고 {!canOut && '(비활성)'}</span>
                </button>
              </div>

              {/* Input Fields */}
              <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tx-date" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Calendar size={13} /> 작업일자
                    </label>
                    <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="tx-quantity" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <FileText size={13} /> {type === 'IN' ? '입고' : '출고'} 수량 (EA)
                    </label>
                    <input
                      id="tx-quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        setPackCalcInput('');
                      }}
                      onKeyDown={handleQuantityKeyDown}
                      placeholder="0"
                      step="1"
                      min="1"
                      className={`${inputClass} text-right font-bold text-lg ${type === 'IN' ? 'text-orange-600' : 'text-red-600'}`}
                      required
                    />
                  </div>
                </div>

                {/* Fixed Pack Conversion Helper (SET / BOX -> EA) */}
                {hasUnitConversion && (
                  <div className="p-2.5 rounded-lg bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-800/50 flex items-center gap-2 text-xs">
                    <Calculator size={14} className="text-orange-500 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 shrink-0 font-medium">
                      {item.unit} 환산 입력 (×{formatInteger(item.eaPerUnit)} EA):
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={packCalcInput}
                      onChange={(e) => handlePackCalcChange(e.target.value)}
                      placeholder={`${item.unit} 수`}
                      className="w-24 px-2 py-1 text-right border border-orange-300 dark:border-orange-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tx-worker" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <User size={13} /> 작업자
                    </label>
                    <select id="tx-worker" value={worker} onChange={(e) => handleWorkerChange(e.target.value)} className={selectClass}>
                      {users.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="tx-dept" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Building size={13} /> 담당부서/현장
                    </label>
                    <select id="tx-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {department === '기타부서' && (
                      <input
                        type="text"
                        value={customDepartment}
                        onChange={(e) => setCustomDepartment(e.target.value)}
                        placeholder="부서/라인 직접 입력"
                        className={`${inputClass} mt-2`}
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap">
                    <FileText size={13} /> 비고 (사유 / 소포장 참고)
                  </label>
                  <select id="tx-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
                    {(type === 'IN' ? REASONS_IN : REASONS_OUT).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {reason === '직접입력' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="예: 4000x9pkg + 1000 또는 사용내역"
                      className={`${inputClass} mt-2`}
                      required
                    />
                  )}
                </div>
              </form>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-800 flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                >
                  <RotateCcw size={16} />
                  취소
                </button>
                {editingTx ? (
                  <button
                    type="button"
                    onClick={handleDeleteRequest}
                    className="w-full px-4 py-3 border border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400 font-medium transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                  >
                    <Trash2 size={16} />
                    삭제
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="submit"
                  form="transaction-form"
                  className={`w-full px-4 py-3 rounded-lg text-white font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 text-sm whitespace-nowrap ${
                    editingTx ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  <Check size={16} />
                  저장
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 min-w-0">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 bg-white dark:bg-slate-900 sticky top-0">
              <div className="flex items-center gap-2 min-w-0">
                <History size={20} className="text-slate-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm whitespace-nowrap">
                  {historyView === 'all' ? '전체 이력' : historyView === 'year' ? '연간 이력 (선택년도)' : '월간 이력 (선택월)'}
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                <button
                  onClick={() => setHistoryView('month')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                    historyView === 'month'
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  월간
                </button>
                <button
                  onClick={() => setHistoryView('year')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                    historyView === 'year'
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  연간
                </button>
                <button
                  onClick={() => setHistoryView('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${
                    historyView === 'all'
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  전체
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white dark:bg-slate-900">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 sticky top-0 z-10 text-xs uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">날짜</th>
                    <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">구분</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">수량 (EA)</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">잔고 (EA)</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">작업자</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`transition-colors cursor-pointer ${
                        editingTx?.id === tx.id ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                      onClick={() => handleStartEdit(tx)}
                    >
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{tx.date}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                            tx.type === 'IN'
                              ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
                              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                          }`}
                        >
                          {tx.type === 'IN' ? '입고' : '출고'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold font-mono ${tx.type === 'IN' ? 'text-orange-600' : 'text-red-600'}`}>
                        {tx.type === 'IN' ? '+' : '-'}
                        {formatInteger(tx.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs font-mono">
                        {formatInteger((tx as any).computedStock ?? tx.currentStockSnapshot)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs font-medium">
                        {tx.worker}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate" title={tx.reason}>
                        {editingTx?.id === tx.id ? <span className="font-bold text-orange-600 dark:text-orange-400">선택됨</span> : tx.reason}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-20">
                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                          <Search size={32} className="mb-2 opacity-50" />
                          <p className="text-sm">해당 기간에 수불 이력이 없습니다.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmationModal
          title="이력 삭제 확인"
          message={
            <div className="space-y-2 text-sm">
              <p>선택하신 이력을 정말 삭제하시겠습니까?</p>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-center my-2">
                <span className="font-mono text-slate-600 dark:text-slate-400 mr-2">{deleteTarget.date}</span>
                <span className={`font-bold ${deleteTarget.type === 'IN' ? 'text-orange-600' : 'text-red-600'}`}>
                  {deleteTarget.type === 'IN' ? '입고' : '출고'} {formatInteger(deleteTarget.quantity)} EA
                </span>
              </div>
              <p className="text-amber-600 font-bold dark:text-amber-400 text-xs">
                * 삭제 시 현재 재고 수량이 자동으로 재계산됩니다.
              </p>
            </div>
          }
          confirmLabel="삭제"
          isDangerous={true}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {alertModal && (
        <ConfirmationModal
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel="확인"
          onConfirm={() => setAlertModal(null)}
        />
      )}
    </div>
  );
};

export default TransactionModal;
