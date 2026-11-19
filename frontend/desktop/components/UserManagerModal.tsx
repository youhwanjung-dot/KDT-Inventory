import React, { useState } from 'react';
import { X, UserPlus, Trash2, Edit, Save, Shield, User as UserIcon, Users, Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { TxPermission, User, UserRole } from '../types';
import { USER_DEPARTMENTS } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import { ActionLogger } from '../utils/logger';
import { api } from '../utils/api';

interface UserManagerModalProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  onClose: () => void;
}

const TX_PERM_LABELS: Record<TxPermission, string> = {
  ALL: '전체 (입고+출고)',
  IN_ONLY: '입고 전용',
  OUT_ONLY: '출고 전용',
};

const resolveTxPermission = (user: Pick<User, 'role' | 'txPermission'>): TxPermission => {
  if (user.role === 'admin') return 'ALL';
  return user.txPermission || 'OUT_ONLY';
};

const UserManagerModal: React.FC<UserManagerModalProps> = ({ users, onUpdateUsers, onClose }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Omit<User, 'id'> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartAdd = () => {
    setNewUser({ name: '', password: '', role: 'user', txPermission: 'OUT_ONLY', department: '제조팀' });
    setEditingUser(null);
  };

  const handleStartEdit = (user: User) => {
    setEditingUser({ ...user, txPermission: resolveTxPermission(user) });
    setNewUser(null);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setNewUser(null);
  };

  const handleSave = async () => {
    let updatedUsers = [...users];

    if (editingUser) {
      if (!editingUser.name.trim()) {
        setAlertModal({ title: '입력 오류', message: '이름은 필수입니다.' });
        return;
      }
      const trimmedName = editingUser.name.trim();
      if (users.some((u) => u.id !== editingUser.id && u.name.trim() === trimmedName)) {
        setAlertModal({ title: '중복 사용자', message: '이미 동일한 이름의 사용자가 존재합니다.' });
        return;
      }
      const finalPerm: TxPermission = editingUser.role === 'admin' ? 'ALL' : resolveTxPermission(editingUser);
      const finalDepartment = editingUser.department || '제조팀';
      updatedUsers = users.map((u) =>
        u.id === editingUser.id ? { ...editingUser, name: trimmedName, txPermission: finalPerm, department: finalDepartment } : u
      );
    } else if (newUser) {
      if (!newUser.name.trim() || !newUser.password) {
        setAlertModal({ title: '입력 오류', message: '이름과 비밀번호는 필수입니다.' });
        return;
      }
      const trimmedName = newUser.name.trim();
      if (users.some((u) => u.name.trim() === trimmedName)) {
        setAlertModal({ title: '중복 사용자', message: '이미 동일한 이름의 사용자가 존재합니다.' });
        return;
      }
      const newId = `user-${Date.now()}`;
      const finalPerm: TxPermission = newUser.role === 'admin' ? 'ALL' : resolveTxPermission(newUser);
      const finalDepartment = newUser.department || '제조팀';
      updatedUsers = [...users, { id: newId, ...newUser, name: trimmedName, txPermission: finalPerm, department: finalDepartment }];
    }

    setIsSaving(true);
    try {
      await api.updateUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      if (editingUser) ActionLogger.log('User Updated', { id: editingUser.id, perm: editingUser.txPermission });
      else if (newUser) ActionLogger.log('User Added', { name: newUser.name.trim(), perm: newUser.txPermission });
      handleCancel();
    } catch (err: any) {
      setAlertModal({ title: '저장 실패', message: `서버 저장에 실패했습니다: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (user: User) => {
    if (user.id === 'admin') {
      setAlertModal({ title: '삭제 불가', message: '기본 관리자 계정은 삭제할 수 없습니다.' });
      return;
    }
    setDeleteTarget(user);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const updatedUsers = users.filter((u) => u.id !== deleteTarget.id);
    setIsSaving(true);
    try {
      await api.updateUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      ActionLogger.log('User Deleted', { id: deleteTarget.id });
      setDeleteTarget(null);
    } catch (err: any) {
      setAlertModal({ title: '삭제 실패', message: `서버 저장에 실패했습니다: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const renderPermissionBadge = (user: User) => {
    const perm = resolveTxPermission(user);
    if (user.role === 'admin' || perm === 'ALL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
          전체 (입고+출고)
        </span>
      );
    }
    if (perm === 'IN_ONLY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
          <ArrowDownToLine size={12} /> 입고 전용
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
        <ArrowUpFromLine size={12} /> 출고 전용
      </span>
    );
  };

  const renderEditRow = (userState: User | Omit<User, 'id'>, setUserState: Function) => {
    const isAdmin = userState.role === 'admin';
    return (
      <div className="grid grid-cols-14 gap-2 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg animate-fade-in items-center">
        <input
          type="text"
          placeholder="이름 / 직책"
          value={userState.name}
          onChange={(e) => setUserState({ ...userState, name: e.target.value })}
          className="col-span-3 px-2.5 py-1.5 text-sm border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
        />
        <input
          type="password"
          placeholder={'id' in userState ? '변경 시에만 입력' : '초기 비밀번호'}
          value={userState.password ?? ''}
          onChange={(e) => setUserState({ ...userState, password: e.target.value })}
          className="col-span-2 px-2.5 py-1.5 text-sm border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
        />
        <select
          value={userState.role}
          onChange={(e) => {
            const nextRole = e.target.value as UserRole;
            setUserState({
              ...userState,
              role: nextRole,
              txPermission: nextRole === 'admin' ? 'ALL' : userState.txPermission || 'OUT_ONLY',
            });
          }}
          className="col-span-2 px-2 py-1.5 text-sm border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
        >
          <option value="user">일반 사용자</option>
          <option value="admin">관리자</option>
        </select>
        <select
          value={userState.department || '제조팀'}
          onChange={(e) => setUserState({ ...userState, department: e.target.value })}
          className="col-span-2 px-2 py-1.5 text-sm border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
        >
          {USER_DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <select
          value={isAdmin ? 'ALL' : userState.txPermission || 'OUT_ONLY'}
          disabled={isAdmin}
          onChange={(e) => setUserState({ ...userState, txPermission: e.target.value as TxPermission })}
          className="col-span-3 px-2 py-1.5 text-sm border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white disabled:opacity-60"
        >
          {(Object.keys(TX_PERM_LABELS) as TxPermission[]).map((permKey) => (
            <option key={permKey} value={permKey}>
              {TX_PERM_LABELS[permKey]}
            </option>
          ))}
        </select>
        <div className="col-span-2 flex items-center justify-end gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded disabled:opacity-50"
            title="저장"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-50"
            title="취소"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users size={20} className="text-orange-600 dark:text-orange-400" />
                사용자 및 입출고 권한 관리
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                계정별 역할, 담당부서, 입출고 모달 권한(입고 전용 / 출고 전용 / 전체)을 관리합니다.
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-14 gap-2 px-2.5 pb-2 mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <div className="col-span-3">작업자(계정명)</div>
              <div className="col-span-2">비밀번호</div>
              <div className="col-span-2">시스템 역할</div>
              <div className="col-span-2">담당부서</div>
              <div className="col-span-3">입출고 담당 권한</div>
              <div className="col-span-2 text-right">관리</div>
            </div>
            <div className="space-y-2">
              {users.map((user) =>
                editingUser?.id === user.id ? (
                  <React.Fragment key={user.id}>{renderEditRow(editingUser, setEditingUser)}</React.Fragment>
                ) : (
                  <div
                    key={user.id}
                    className="grid grid-cols-14 gap-2 px-2.5 py-2 items-center hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg group"
                  >
                    <div className="col-span-3 font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name}</div>
                    <div className="col-span-2 font-mono text-xs text-slate-400">••••••••</div>
                    <div className="col-span-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {user.role === 'admin' ? (
                        <Shield size={15} className="text-amber-500 shrink-0" />
                      ) : (
                        <UserIcon size={15} className="text-slate-400 shrink-0" />
                      )}
                      <span>{user.role === 'admin' ? '관리자' : '일반'}</span>
                    </div>
                    <div className="col-span-2 text-sm text-slate-700 dark:text-slate-300 truncate">{user.department || '제조팀'}</div>
                    <div className="col-span-3">{renderPermissionBadge(user)}</div>
                    <div className="col-span-2 flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(user)}
                        className="p-2 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded"
                        title="수정"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(user)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              )}
              {newUser && renderEditRow(newUser, setNewUser)}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
            <button
              onClick={handleStartAdd}
              disabled={!!editingUser || !!newUser}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
            >
              <UserPlus size={16} />
              신규 사용자 추가
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmationModal
          title="사용자 삭제 확인"
          message={
            <div>
              <p>
                사용자 <strong className="text-slate-800 dark:text-slate-100">{deleteTarget.name}</strong> 계정을 영구적으로 삭제하시겠습니까?
              </p>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">이 작업은 되돌릴 수 없습니다.</p>
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
    </>
  );
};

export default UserManagerModal;
