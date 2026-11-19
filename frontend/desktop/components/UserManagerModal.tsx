import React, { useState } from 'react';
import { X, UserPlus, Trash2, Edit, Save, Shield, User as UserIcon, Users, Loader2 } from 'lucide-react';
import { User, UserRole } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { ActionLogger } from '../utils/logger';
import { api } from '../utils/api';

interface UserManagerModalProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  onClose: () => void;
}

const UserManagerModal: React.FC<UserManagerModalProps> = ({ users, onUpdateUsers, onClose }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Omit<User, 'id'> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: React.ReactNode } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleStartAdd = () => {
    setNewUser({ name: '', password: '', role: 'user' });
    setEditingUser(null);
  };
  
  const handleStartEdit = (user: User) => {
    setEditingUser({ ...user });
    setNewUser(null);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setNewUser(null);
  };

  const handleSave = async () => {
    let updatedUsers = [...users];

    if (editingUser) {
      if (!editingUser.name) {
        setAlertModal({ title: '입력 오류', message: '이름은 필수입니다.' });
        return;
      }
      const trimmedName = editingUser.name.trim();
      if (users.some(u => u.id !== editingUser.id && u.name.trim() === trimmedName)) {
        setAlertModal({ title: '중복 사용자', message: '이미 동일한 이름의 사용자가 존재합니다.' });
        return;
      }
      // password 빈칸 = 기존 비번 유지 (백엔드에서 처리)
      updatedUsers = users.map(u => u.id === editingUser.id ? { ...editingUser, name: trimmedName } : u);
    } else if (newUser) {
      if (!newUser.name || !newUser.password) {
        setAlertModal({ title: '입력 오류', message: '이름과 비밀번호는 필수입니다.' });
        return;
      }
      const trimmedName = newUser.name.trim();
      if (users.some(u => u.name.trim() === trimmedName)) {
        setAlertModal({ title: '중복 사용자', message: '이미 동일한 이름의 사용자가 존재합니다.' });
        return;
      }
      const newId = `user-${Date.now()}`;
      updatedUsers = [...users, { id: newId, ...newUser, name: trimmedName }];
    }

    // Firestore에 영구 저장
    setIsSaving(true);
    try {
      await api.updateUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      // API 성공 후 로깅
      if (editingUser) ActionLogger.log('User Updated', { id: editingUser.id });
      else if (newUser) ActionLogger.log('User Added', { name: (newUser as any).name?.trim() });
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
    if (deleteTarget) {
      const updatedUsers = users.filter(u => u.id !== deleteTarget.id);
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
    }
  };

  const renderRoleIcon = (role: UserRole) => {
    return role === 'admin' 
      ? <Shield size={16} className="text-amber-500" /> 
      : <UserIcon size={16} className="text-slate-400" />;
  };
  
  const renderEditRow = (userState: User | Omit<User, 'id'>, setUserState: Function) => (
     <div className="grid grid-cols-4 gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-fade-in">
        <input 
          type="text"
          placeholder="이름"
          value={userState.name}
          onChange={(e) => setUserState({ ...userState, name: e.target.value })}
          className="col-span-1 px-2 py-1 border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
        />
        <input 
          type="password"
          placeholder={userState && ('id' in userState) ? '변경 시에만 입력' : '비밀번호'}
          value={userState.password ?? ''}
          onChange={(e) => setUserState({ ...userState, password: e.target.value })}
          className="col-span-1 px-2 py-1 border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
        />
        <select 
          value={userState.role}
          onChange={(e) => setUserState({ ...userState, role: e.target.value as UserRole })}
          className="col-span-1 px-2 py-1 border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
        >
          <option value="user">일반 사용자</option>
          <option value="admin">관리자</option>
        </select>
        <div className="col-span-1 flex items-center justify-end gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-2 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          </button>
          <button onClick={handleCancel} disabled={isSaving} className="p-2 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-50"><X size={18} /></button>
        </div>
     </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
              사용자 계정 관리
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">시스템 사용자 계정을 추가, 수정, 삭제합니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-3">
            {users.map(user => (
              editingUser?.id === user.id 
                ? renderEditRow(editingUser, setEditingUser)
                : (
                  <div key={user.id} className="grid grid-cols-4 gap-2 p-2 items-center hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group">
                    <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{user.name}</div>
                    <div className="font-mono text-slate-500 dark:text-slate-400">********</div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      {renderRoleIcon(user.role)}
                      <span>{user.role === 'admin' ? '관리자' : '일반 사용자'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleStartEdit(user)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteRequest(user)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-800 rounded"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
            ))}
            {newUser && renderEditRow(newUser, setNewUser)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
          <button
            onClick={handleStartAdd}
            disabled={!!editingUser || !!newUser}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
          >
            <UserPlus size={16} />
            신규 사용자 추가
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
    {deleteTarget && (
        <ConfirmationModal
          title="사용자 삭제 확인"
          message={<div><p>사용자 <strong className="text-slate-800 dark:text-slate-100">{deleteTarget.name}</strong> 계정을 영구적으로 삭제하시겠습니까?</p><p className="mt-2 text-sm text-red-600 dark:text-red-400">이 작업은 되돌릴 수 없습니다.</p></div>}
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
