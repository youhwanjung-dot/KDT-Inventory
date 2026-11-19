import React, { useState, useEffect } from 'react';
import { Factory, Lock, User, ChevronDown, Check } from 'lucide-react';
import { User as UserType } from '../types';
import { APP_VERSION, BUILD_TIMESTAMP } from '../constants';
import { api } from '../utils/api';
import { purgeCacheAndCheckVersion, checkForServerUpdate, forceHardReload } from '../utils/cacheBuster';

interface LoginProps {
  users: UserType[];
  onLogin: (user: UserType) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const getRoleBadgeText = (u: UserType): string => {
  if (u.role === 'admin') return '관리자';
  if (u.txPermission === 'IN_ONLY') return '입고담당';
  if (u.txPermission === 'OUT_ONLY') return '출고담당';
  return '일반';
};

const Login: React.FC<LoginProps> = ({ users, onLogin, isDarkMode, toggleDarkMode }) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [statusText, setStatusText] = useState('보안 세션 및 캐시 정밀 검증 중');

  useEffect(() => {
    document.title = '로그인 | KDT 자재관리 시스템';
    const lastUserId = localStorage.getItem('kdt_last_login_user_id');
    if (lastUserId && users.length > 0) {
      const idx = users.findIndex((u) => u.id === lastUserId);
      if (idx !== -1) {
        setSelectedIdx(idx);
      }
    }

    checkForServerUpdate().then((hasUpdate) => {
      if (hasUpdate) {
        purgeCacheAndCheckVersion().then(() => {
          forceHardReload();
        });
      }
    });
  }, [users]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedUser = users[selectedIdx];
    if (!selectedUser) return;
    setIsLoggingIn(true);
    setError('');
    setStatusText('보안 세션 복원 및 브라우저 캐시 자동 소거 중...');

    try {
      await purgeCacheAndCheckVersion();

      const response = await api.login({
        userId: selectedUser.id,
        password: password,
        device: 'desktop',
      });

      localStorage.setItem('kdt_last_login_user_id', selectedUser.id);
      localStorage.setItem('session_token', response.token);

      const hasServerUpdate = await checkForServerUpdate();
      if (hasServerUpdate) {
        setStatusText('최신 버전 업데이트 적용 중...');
        setTimeout(() => {
          forceHardReload();
        }, 500);
        return;
      }

      const resolvedUser: UserType = {
        ...selectedUser,
        ...(response.user || {}),
        txPermission: response.user?.txPermission || selectedUser.txPermission || (selectedUser.role === 'admin' ? 'ALL' : 'OUT_ONLY'),
      };
      onLogin(resolvedUser);
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || '로그인에 실패했습니다. (서버 연결 확인)');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transition-colors duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-orange-600 dark:bg-orange-900 p-6 text-center shrink-0">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">KDT 자재 재고관리</h1>
          <div className="text-orange-100 text-sm flex items-center justify-center gap-2">
            <span>ZONE별 통합 수불 관리 시스템</span>
            <span
              className="bg-orange-500/50 px-1.5 py-0.5 rounded text-[10px] border border-orange-400/50 cursor-help"
              title={`빌드 일시: ${BUILD_TIMESTAMP}`}
            >
              Ver{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">로그인 계정</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
                  <User size={18} />
                </div>
                <select
                  aria-label="로그인 계정 선택"
                  title="로그인할 계정을 선택하세요"
                  value={selectedIdx}
                  onChange={(e) => setSelectedIdx(Number(e.target.value))}
                  className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-900 dark:text-white appearance-none transition-colors cursor-pointer text-sm"
                >
                  {users.map((u, idx) => (
                    <option key={u.id} value={idx}>
                      {u.name} ({getRoleBadgeText(u)})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-900 dark:text-white transition-colors text-sm placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              {error && <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>}
            </div>

            <div className="pt-2">
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => isDarkMode && toggleDarkMode()}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${!isDarkMode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  <span>일반 모드</span>
                  {!isDarkMode && <Check size={14} className="text-orange-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => !isDarkMode && toggleDarkMode()}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${isDarkMode
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <span>다크 모드</span>
                  {isDarkMode && <Check size={14} className="text-orange-300" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 mt-4"
            >
              시스템 접속
            </button>
          </form>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 text-center border-t border-slate-100 dark:border-slate-700 shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            &copy; 2026 KDT Inventory Management System. Powered by KyungHun System.
          </p>
          <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">
            Ver{APP_VERSION} · Build: {BUILD_TIMESTAMP}
          </p>
        </div>
      </div>

      {isLoggingIn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-50 animate-fade-in">
          <style>{`
            @keyframes progress-flow {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .animate-progress-flow {
              background: linear-gradient(270deg, #2563eb, #60a5fa, #2563eb);
              background-size: 200% 200%;
              animation: progress-flow 1.5s ease infinite;
            }
          `}</style>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-slate-100 dark:border-slate-700 text-center space-y-4">
            <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-orange-600 dark:border-t-orange-400 animate-spin"></div>
              <Factory size={20} className="text-orange-600 dark:text-orange-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">보안 세션 및 최신 버전 동기화</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{statusText}</p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full animate-progress-flow w-4/5"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
