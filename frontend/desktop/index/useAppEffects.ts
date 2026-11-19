import { useEffect } from 'react';
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
      setInventory(normalizeInventory(items));
    });

    const unsubTransactions = subscribeTransactions((txs) => {
      setTransactions(normalizeTransactions(txs));
    });

    const unsubMasterData = subscribeMasterData((md) => {
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

  // Session check (every 30s + on window focus)
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

        if (!result.valid) {
          setAlertModal({
            title: '세션 종료',
            message: '다른 기기에서 로그인하여 접속이 종료됩니다.',
          });
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    };

    const intervalId = setInterval(checkSession, 30000);
    const handleFocus = () => checkSession();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);
}
