import { useEffect, useRef } from 'react';
import {
  APP_VERSION,
  APP_VERSION_STORAGE_KEY,
  INITIAL_INVENTORY,
  INITIAL_TRANSACTIONS,
  MOCKUP_MODE,
  SESSION_USER_KEY,
  SESSION_VIEW_KEY,
  STORAGE_MODE,
} from '../constants';
import { api } from '../utils/api';
import {
  subscribeInventory,
  subscribeTransactions,
  subscribeMasterData,
} from '../utils/firebaseClient';
import { AppState, normalizeInventory, normalizeTransactions } from './useAppState';

export function useAppEffects(state: AppState) {
  const {
    user,
    isDarkMode,
    setInventory,
    setTransactions,
    setMasterData,
    setUsers,
    setAlertModal,
    setUser,
    setCurrentView,
    realtimePausedRef,
  } = state;

  // Dark mode sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Clear session on Ctrl+F5 hard reload
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && (e.ctrlKey || e.shiftKey)) {
        try {
          sessionStorage.removeItem(SESSION_USER_KEY);
          sessionStorage.removeItem(SESSION_VIEW_KEY);
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial data load + Firestore real-time listeners (with MOCKUP_MODE / STORAGE_MODE branching per Rule 7)
  useEffect(() => {
    const storedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);
    if (storedVersion !== null && storedVersion !== APP_VERSION) {
      console.log(`[Auto Reload] Version changed: ${storedVersion} -> ${APP_VERSION}.`);
      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
      window.location.reload();
      return;
    }
    if (storedVersion === null) {
      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    }

    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      // Mockup / Local branch preserved per Rule 7
      setInventory(normalizeInventory(INITIAL_INVENTORY));
      setTransactions(normalizeTransactions(INITIAL_TRANSACTIONS));
      const categories = Array.from(new Set(INITIAL_INVENTORY.map((i) => i.category)));
      const namesByCategory: Record<string, string[]> = {};
      categories.forEach((c) => {
        namesByCategory[c] = INITIAL_INVENTORY.filter((i) => i.category === c).map((i) => i.name);
      });
      setMasterData({ categories, namesByCategory, nameOrder: [], zoneMeta: {} });
      return;
    }

    // Cloud (Firestore) real-time listeners
    const unsubInventory = subscribeInventory((items) => {
      // Migration 진행 중에는 onSnapshot이 중간 상태로 로컬 상태를 덮어쓰지 않도록 억제
      if (realtimePausedRef.current) return;
      setInventory(normalizeInventory(items));
    });

    const unsubTransactions = subscribeTransactions((txs) => {
      if (realtimePausedRef.current) return;
      setTransactions(normalizeTransactions(txs));
    });

    const unsubMasterData = subscribeMasterData((md) => {
      if (realtimePausedRef.current) return;
      setMasterData({
        categories: md.categories,
        namesByCategory: md.namesByCategory,
        nameOrder: md.nameOrder,
        zoneMeta: md.zoneMeta || {},
      });
    });

    api
      .getUsers()
      .then((userData) => {
        if (userData.length > 0) setUsers(userData);
      })
      .catch(() => {});

    return () => {
      unsubInventory();
      unsubTransactions();
      unsubMasterData();
    };
  }, []);

  // Session check (every 30s) + window focus sync (data refresh)
  const lastFocusSyncRef = useRef(0);
  const sessionRetryRef = useRef(false);

  const performLogout = () => {
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem(SESSION_VIEW_KEY);
    } catch {}
    localStorage.removeItem('session_token');
    setUser(null);
    setCurrentView('DASHBOARD');
  };

  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        const token = localStorage.getItem('session_token');
        if (!token) return;

        const result = await api.checkSession({
          userId: user.id,
          device: 'desktop',
          token,
        });

        if (result.valid) {
          sessionRetryRef.current = false;
          return;
        }

        // 일시적 오류(user_not_found, check_error)는 1회 재시도 후에도 실패하면 로그아웃
        if (result.reason !== 'session_expired') {
          if (!sessionRetryRef.current) {
            sessionRetryRef.current = true;
            return;
          }
        }

        // session_expired 또는 재시도 실패 시 로그아웃
        setAlertModal({
          title: '세션 종료',
          message: '다른 기기에서 로그인하여 접속이 종료됩니다.',
        });
        performLogout();
      } catch (error) {
        console.error('Session check failed:', error);
      }
    };

    // Window focus 시 최신 데이터 강제 재조회 (노트북-PC 동기화 시차 해소)
    const refreshDataOnFocus = async () => {
      if (MOCKUP_MODE || STORAGE_MODE === 'Local') return;
      // Migration 진행 중이면 스킵
      if (realtimePausedRef.current) return;
      // 너무 잦은 호출 방지 (최소 3초 간격)
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 3000) return;
      lastFocusSyncRef.current = now;

      try {
        const [items, txs] = await Promise.all([
          api.getInventory(),
          api.getTransactions(),
        ]);
        setInventory(normalizeInventory(items));
        setTransactions(normalizeTransactions(txs));
      } catch (error) {
        console.error('[Focus Sync] data refresh failed:', error);
      }
    };

    const intervalId = setInterval(checkSession, 30000);
    const handleFocus = () => {
      checkSession();
      refreshDataOnFocus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);
}
