import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, Calendar, User, Building, FileText, ArrowUpCircle, ArrowDownCircle, History, Trash2, Edit, PlusCircle, AlignJustify, Search, AlertTriangle, RotateCcw } from 'lucide-react';
import { InventoryItem, InventoryTransaction, User as UserType } from '../types';
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

const DEPARTMENTS = ['요양팀', '복지팀', '간호팀', '시설팀', '기타부서'];
const REASONS_IN = ['구매입고', '기증입고', '반품입고', '직접입력'];
const REASONS_OUT = ['현장사용', '망실폐기', '반품출고', '직접입력'];

const TransactionModal: React.FC<TransactionModalProps> = ({ item, transactions = [], currentUser, users, onSave, onUpdate, onDelete, onClose }) => {
  const [editingTx, setEditingTx] = useState<InventoryTransaction | null>(null);

  // Form State
  const [type, setType] = useState<'IN' | 'OUT'>('OUT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('1');

  const [worker, setWorker] = useState(currentUser.name);

  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [customDepartment, setCustomDepartment] = useState('');

  const [reason, setReason] = useState(REASONS_OUT[0]);
  const [customReason, setCustomReason] = useState('');

  // History View State
  const [historyView, setHistoryView] = useState<'month' | 'year' | 'all'>('all'); // Default to 'all'
  const [deleteTarget, setDeleteTarget] = useState<InventoryTransaction | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);

  // -------------------------------------------------------------------------
  // 잔고 계산: DB의 currentStockSnapshot을 신뢰하지 않고
  // 현재 item.currentStock 기준으로 전체 이력을 역산(최신→과거)하여
  // 각 행의 "거래 직후 잔고"를 프론트에서 항상 정확하게 계산한다.
  // -------------------------------------------------------------------------
  const itemTransactionsWithStock = useMemo(() => {
    // 1) 해당 품목의 이력을 날짜+ID 오름차순(과거→최신)으로 정렬
    const sorted = transactions
      .filter(t => t.itemId === item.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    // 2) 현재 재고(item.currentStock)가 최신 거래 직후 값이므로
    //    역순으로 뺀 후 순방향으로 재계산
    let runningStock = Number(item.currentStock) || 0;

    // 먼저 최신→과거 방향으로 각 행의 "거래 이전 재고"를 파악
    //   거래 직후 재고 = 거래 이전 재고 ± qty
    //   → 역산: 거래 이전 재고 = 거래 직후 재고 ∓ qty
    // 가장 최신 행부터 역순 누적
    const stockAfter: number[] = new Array(sorted.length).fill(0);
    let rolling = runningStock;
    for (let i = sorted.length - 1; i >= 0; i--) {
      stockAfter[i] = rolling; // 이 거래 직후의 재고
      const qty = Number(sorted[i].quantity) || 0;
      const delta = sorted[i].type === 'IN' ? qty : -qty;
      rolling = rolling - delta; // 이 거래 이전 재고
    }

    // 3) 계산된 computedStock을 각 이력에 부착, 표시용 내림차순으로 뒤집기
    const result = sorted.map((tx, i) => ({
      ...tx,
      computedStock: stockAfter[i],
    })).reverse(); // 화면은 최신→과거 순

    return result;
  }, [transactions, item.id, item.currentStock]);

  const filteredTransactions = useMemo(() => {
    if (historyView === 'all') {
      return itemTransactionsWithStock;
    } else if (historyView === 'year') {
      const selectedYear = (date ? new Date(date) : new Date()).getFullYear();
      return itemTransactionsWithStock.filter(tx => {
        const txYear = new Date(tx.date).getFullYear();
        return txYear === selectedYear;
      });
    } else { // 'month'
      const targetDate = date ? new Date(date) : new Date();
      const targetMonth = targetDate.toISOString().slice(0, 7); // YYYY-MM
      return itemTransactionsWithStock.filter(tx => tx.date.startsWith(targetMonth));
    }
  }, [itemTransactionsWithStock, historyView, date]);

  const resetForm = () => {
    setType('OUT');
    setDate(new Date().toISOString().split('T')[0]);
    setQuantity('1');
    setWorker(currentUser.name);
    setDepartment(DEPARTMENTS[0]);
    setReason(REASONS_OUT[0]);
    setCustomDepartment('');
    setCustomReason('');
    setEditingTx(null);
  };

  useEffect(() => {
    resetForm();
    setType('OUT');
    setReason(REASONS_OUT[0]);
    // Allow user to see all history initially
    setHistoryView('all');
  }, [item, currentUser.name]);

  const handleTypeChange = (newType: 'IN' | 'OUT') => {
    setType(newType);
    if (!editingTx) {
      setReason(newType === 'IN' ? REASONS_IN[0] : REASONS_OUT[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || parseFloat(quantity) <= 0) {
      setAlertModal({ title: '입력 오류', message: '수량은 0보다 커야 합니다.' });
      return;
    }

    const txData = {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      date,
      type,
      quantity: parseFloat(quantity),
      worker: worker,
      department: department === '기타부서' ? customDepartment : department,
      reason: (reason === '직접입력') ? customReason : reason,
    };

    if (editingTx) {
      onUpdate(editingTx, txData);
    } else {
      onSave(txData);
    }

    resetForm();
  };

  const handleStartEdit = (tx: InventoryTransaction) => {
    setEditingTx(tx);
    setType(tx.type);
    setDate(tx.date);
    setQuantity(String(tx.quantity));
    setWorker(tx.worker);

    if (DEPARTMENTS.includes(tx.department)) {
      setDepartment(tx.department);
      setCustomDepartment('');
    } else {
      setDepartment('기타부서');
      setCustomDepartment(tx.department);
    }

    const reasons = tx.type === 'IN' ? REASONS_IN : REASONS_OUT;
    if (reasons.includes(tx.reason)) {
      setReason(tx.reason);
      setCustomReason('');
    } else {
      setReason('직접입력');
      setCustomReason(tx.reason);
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
      resetForm(); // Reset form after deletion
    }
  };

  
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentVal = parseFloat(quantity) || 0;
      const adjustment = e.key === 'ArrowUp' ? 1 : -1;
      const newVal = Math.max(0.1, currentVal + adjustment);
      setQuantity(String(parseFloat(newVal.toFixed(1))));
    }
  };

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors";
  const selectClass = `${inputClass} appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] pr-8`;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="text-blue-600 dark:text-blue-400" size={22} />
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">입출고 관리 및 이력</h2>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {item.category} &gt; <span className="text-slate-800 dark:text-slate-200 font-bold">{item.name}</span>
              <span className="mx-3 text-slate-300">|</span>
              현재고: <span className="text-blue-600 dark:text-blue-400 font-bold text-base">{Number(item.currentStock).toFixed(1)}개</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-white dark:bg-slate-800 p-1 rounded-full border border-transparent hover:border-slate-200">
            <X size={24} />
          </button>
        </div>

        {/* Body Layout: 2 Columns */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Column: Form */}
          <div className="w-[420px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-6 space-y-6">

              {/* Section Title */}
              <div className={`flex items-center gap-2 font-bold text-sm ${editingTx ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {editingTx ? <AlertTriangle size={18} /> : <PlusCircle size={18} />}
                <span>{editingTx ? '내역 수정 및 삭제' : '신규 내역 등록'}</span>
              </div>

              {/* Type Toggle (Big Buttons) */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('IN')}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold transition-all ${type === 'IN'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                    }`}
                >
                  <ArrowUpCircle size={20} />
                  입고 (채움)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('OUT')}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold transition-all ${type === 'OUT'
                      ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 shadow-sm ring-1 ring-red-500'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                    }`}
                >
                  <ArrowDownCircle size={20} />
                  출고 (사용)
                </button>
              </div>

              {/* Input Fields */}
              <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tx-date" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar size={13} /> 작업일자
                    </label>
                    <input id="tx-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} required />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="tx-quantity" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <FileText size={13} /> {type === 'IN' ? '입고' : '출고'} 수량
                    </label>
                    <input id="tx-quantity"
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      onKeyDown={handleQuantityKeyDown}
                      placeholder="0"
                      step="0.1"
                      min="0.1"
                      className={`${inputClass} text-right font-bold text-lg ${type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tx-worker" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <User size={13} /> 작업자
                    </label>
                    <select id="tx-worker" value={worker} onChange={e => setWorker(e.target.value)} className={selectClass}>
                      {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="tx-dept" className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Building size={13} /> 사용현장
                    </label>
                    <select id="tx-dept" value={department} onChange={e => setDepartment(e.target.value)} className={selectClass}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {department === '기타부서' && (
                      <input type="text" value={customDepartment} onChange={e => setCustomDepartment(e.target.value)} placeholder="부서명 직접 입력" className={`${inputClass} mt-2`} required />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <FileText size={13} /> 사용내역(사유)
                  </label>
                  <select id="tx-reason" value={reason} onChange={e => setReason(e.target.value)} className={selectClass}>
                    {(type === 'IN' ? REASONS_IN : REASONS_OUT).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {(reason === '직접입력') && (
                    <input type="text" value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="사유 직접 입력" className={`${inputClass} mt-2`} required />
                  )}
                </div>
              </form>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3 pt-4">
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
                  className={`w-full px-4 py-3 rounded-lg text-white font-bold shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 text-sm whitespace-nowrap ${editingTx ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
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

            {/* History Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0">
              <div className="flex items-center gap-2">
                <History size={20} className="text-slate-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {historyView === 'all' ? '전체 이력' : (historyView === 'year' ? '연간 이력 (선택년도)' : '월간 이력 (선택월)')}
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setHistoryView('month')} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${historyView === 'month' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>월간</button>
                <button onClick={() => setHistoryView('year')} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${historyView === 'year' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>연간</button>
                <button onClick={() => setHistoryView('all')} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${historyView === 'all' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>전체</button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white dark:bg-slate-900">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 sticky top-0 z-10 text-xs uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">날짜</th>
                    <th className="px-4 py-3 font-semibold text-center">구분</th>
                    <th className="px-4 py-3 font-semibold text-right">수량</th>
                    <th className="px-4 py-3 font-semibold text-center">재고</th>
                    <th className="px-4 py-3 font-semibold">작업자</th>
                    <th className="px-4 py-3 font-semibold">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map(tx => (
                    <tr
                      key={tx.id}
                      className={`transition-colors cursor-pointer ${editingTx?.id === tx.id ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      onClick={() => handleStartEdit(tx)}
                    >
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{tx.date}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${tx.type === 'IN'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                          }`}>
                          {tx.type === 'IN' ? '입고' : '출고'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${tx.type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}>
                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">
                        {((tx as any).computedStock ?? tx.currentStockSnapshot).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">
                        <div className="font-medium">{tx.worker}</div>
                        <div className="text-[10px] text-slate-400">{tx.department}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs truncate" title={tx.reason}>
                        {editingTx?.id === tx.id ? <span className="font-bold text-orange-600 dark:text-orange-400">선택됨</span> : tx.reason}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-20">
                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                          <Search size={32} className="mb-2 opacity-50" />
                          <p className="text-sm">해당 기간에 거래 이력이 없습니다.</p>
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
                <span className={`font-bold ${deleteTarget.type === 'IN' ? 'text-blue-600' : 'text-red-600'}`}>
                  {deleteTarget.type === 'IN' ? '입고' : '출고'} {deleteTarget.quantity}개
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
