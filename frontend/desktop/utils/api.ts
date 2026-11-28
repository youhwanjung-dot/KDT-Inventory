import {
  InventoryItem,
  InventoryTransaction,
  MasterData,
  User,
  ZoneArchiveData,
  ZoneArchiveSummary,
} from '../types';
import { INITIAL_USERS, MOCKUP_MODE, STORAGE_MODE } from '../constants';

const API_BASE_URL = window.location.port === '5173'
  ? `http://${window.location.hostname}:3500/api`
  : '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchZoneArchivesAPI<T>(path = '', options?: RequestInit): Promise<T> {
  return fetchAPI<T>(`/zone-archives${path}`, options);
}

export const api = {
  // Inventory
  getInventory: async (): Promise<InventoryItem[]> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return [];
    }
    return fetchAPI<InventoryItem[]>('/inventory');
  },
  saveItem: async (item: InventoryItem) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', id: item.id || `INV-${Date.now()}` };
    }
    return fetchAPI<{ message: string; id: string }>('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },
  deleteItem: async (id: string, session: { userId: string; token: string }) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', deletedTransactions: 0 };
    }
    return fetchAPI<{ message: string; deletedTransactions: number }>(`/inventory/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify(session),
    });
  },
  deleteExcludedItems: async (
    itemIds: string[],
    session: { userId: string; token: string }
  ) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', deletedItems: itemIds.length, deletedTransactions: 0 };
    }
    return fetchAPI<{ message: string; deletedItems: number; deletedTransactions: number }>('/inventory', {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteExcludedItems', itemIds, ...session }),
    });
  },

  getZoneArchives: async (): Promise<ZoneArchiveSummary[]> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') return [];
    return fetchZoneArchivesAPI<ZoneArchiveSummary[]>();
  },
  getZoneArchive: async (archiveId: string): Promise<ZoneArchiveData> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      throw new Error('ZONE 아카이브는 Cloud 모드에서만 조회할 수 있습니다.');
    }
    return fetchZoneArchivesAPI<ZoneArchiveData>(`/${encodeURIComponent(archiveId)}`);
  },
  archiveZone: async (data: {
    zoneId: string;
    displayName: string;
    userId: string;
    token: string;
  }) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      throw new Error('ZONE 아카이브는 Cloud 모드에서만 처리할 수 있습니다.');
    }
    return fetchZoneArchivesAPI<{
      message: string;
      archiveId: string;
      itemCount: number;
      transactionCount: number;
      orphanTransactionCount: number;
    }>('', {
      method: 'POST',
      body: JSON.stringify({ ...data, action: 'archive' }),
    });
  },
  restoreZoneArchive: async (data: {
    archiveId: string;
    userId: string;
    token: string;
  }) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      throw new Error('ZONE 아카이브는 Cloud 모드에서만 처리할 수 있습니다.');
    }
    return fetchZoneArchivesAPI<{ message: string; itemCount: number; transactionCount: number }>(
      '',
      { method: 'POST', body: JSON.stringify({ ...data, action: 'restore' }) }
    );
  },
  replaceZoneArchivesFromBackup: async (
    archives: ZoneArchiveData[],
    session: { userId: string; token: string }
  ) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', archiveCount: archives.length };
    }
    for (const archive of archives) {
      await fetchZoneArchivesAPI('', {
        method: 'POST',
        body: JSON.stringify({ action: 'importBackup', archive, ...session }),
      });
    }
    await fetchZoneArchivesAPI('', {
      method: 'POST',
      body: JSON.stringify({
        action: 'finalizeBackupImport',
        archiveIds: archives.map((archive) => archive.id),
        ...session,
      }),
    });
    return { message: 'ok', archiveCount: archives.length };
  },

  // Transactions
  getTransactions: async (): Promise<InventoryTransaction[]> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return [];
    }
    return fetchAPI<InventoryTransaction[]>('/transactions');
  },
  saveTransaction: async (tx: any) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', currentStock: Number(tx.currentStockSnapshot) || 0 };
    }
    return fetchAPI<{ message: string; currentStock: number }>('/transaction', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
  },
  updateTransaction: async (id: string, tx: any) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)' };
    }
    return fetchAPI<{ message: string }>(`/transaction/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(tx),
    });
  },
  deleteTransaction: async (id: string) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)' };
    }
    return fetchAPI<{ message: string }>(`/transaction/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  // 전체 품목 재고 재계산 (서버 즉시 동기화 시 호출)
  recalculateAllStock: async () => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', total: 0, results: [] };
    }
    return fetchAPI<{ message: string; total: number; results: Array<{ itemId: string; currentStock: number }> }>(
      '/transactions/recalculate-all',
      { method: 'POST' }
    );
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return INITIAL_USERS;
    }
    try {
      return await fetchAPI<User[]>('/users');
    } catch {
      return INITIAL_USERS;
    }
  },
  createUser: async (user: User) => {
    return fetchAPI<{ message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },
  updateUsers: async (users: User[]) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)', count: users.length };
    }
    return fetchAPI<{ message: string; count: number }>('/users', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
  },

  // Migration
  migrateData: async (data: {
    inventory: InventoryItem[];
    transactions: InventoryTransaction[];
    masterData?: MasterData;
  }) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return {
        message: 'ok (local/mockup)',
        inventoryCount: data.inventory.length,
        transactionCount: data.transactions.length,
      };
    }
    return fetchAPI<{ message: string; inventoryCount: number; transactionCount: number }>('/migration', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Auth
  login: async (credentials: any) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      const user = INITIAL_USERS.find((u) => u.id === credentials.userId);
      if (!user || String(user.password) !== String(credentials.password)) {
        throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
      return { message: 'ok', token: `local-${Date.now()}`, user };
    }
    try {
      return await fetchAPI<{ message: string; token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    } catch {
      const user = INITIAL_USERS.find((u) => u.id === credentials.userId);
      if (!user || String(user.password) !== String(credentials.password)) {
        throw new Error('로그인에 실패했습니다. (아이디/비밀번호 또는 서버 연결 확인)');
      }
      return { message: 'ok', token: `local-${Date.now()}`, user };
    }
  },
  checkSession: async (sessionData: any) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') return { valid: true };
    try {
      return await fetchAPI<{ valid: boolean; reason?: string }>('/auth/check', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    } catch {
      return { valid: true };
    }
  },
  logout: async (sessionData: any) => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') return { message: 'ok' };
    try {
      return await fetchAPI<{ message: string }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    } catch {
      return { message: 'ok' };
    }
  },

  // Master Data (ZONE)
  getMasterData: async (): Promise<MasterData> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} };
    }
    try {
      const res = await fetch('/masterData');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} };
    }
  },
  saveMasterData: async (data: MasterData): Promise<{ message: string }> => {
    if (MOCKUP_MODE || STORAGE_MODE === 'Local') {
      return { message: 'ok (local/mockup)' };
    }
    const res = await fetch('/masterData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },
};
