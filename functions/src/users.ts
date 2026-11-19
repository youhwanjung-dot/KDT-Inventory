import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

export type TxPermission = 'ALL' | 'IN_ONLY' | 'OUT_ONLY';

export interface StoredUser {
  id: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  txPermission: TxPermission;
  email?: string;
}

const USERS_DOC = () => admin.firestore().collection('config').doc('users');

// KDT Default Users (Q11 + C3 confirmed)
export const DEFAULT_USERS: StoredUser[] = [
  { id: 'admin', name: '관리자',      password: '6922', role: 'admin', txPermission: 'ALL',      email: 'youhwanjung@gmail.com' },
  { id: 'ksh',   name: '김수현 팀장', password: '1234', role: 'user',  txPermission: 'IN_ONLY'  },
  { id: 'hhd',   name: '황호동 반장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'mjw',   name: '문자운 조장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'kmk',   name: '김민기 조장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
  { id: 'lhj',   name: '이호준 계장', password: '1234', role: 'user',  txPermission: 'OUT_ONLY' },
];

export async function getUsersFromDB(): Promise<StoredUser[]> {
  const doc = await USERS_DOC().get();
  if (!doc.exists) {
    await USERS_DOC().set({ users: DEFAULT_USERS });
    logger.info('[users] Seeded KDT default users to Firestore');
    return DEFAULT_USERS;
  }
  const data = doc.data();
  const list = (data?.users ?? DEFAULT_USERS) as StoredUser[];
  return list.map((u) => ({
    ...u,
    txPermission: u.txPermission || (u.role === 'admin' ? 'ALL' : 'OUT_ONLY'),
  }));
}

export const users = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    if (req.method === 'GET') {
      const userList = await getUsersFromDB();
      const safeList = userList.map(({ password: _pw, ...rest }) => rest);
      res.status(200).json(safeList);
      return;
    }

    if (req.method === 'POST') {
      const { users: newUsers } = req.body;
      if (!Array.isArray(newUsers) || newUsers.length === 0) {
        res.status(400).json({ error: 'users array is required' });
        return;
      }

      const hasAdmin = newUsers.some((u: any) => u.role === 'admin');
      if (!hasAdmin) {
        res.status(400).json({ error: '관리자 계정이 최소 1명 이상 필요합니다.' });
        return;
      }

      const existing = await getUsersFromDB();
      const existingMap = new Map(existing.map((u) => [u.id, u]));

      const merged: StoredUser[] = newUsers.map((u: any) => {
        const prev = existingMap.get(u.id);
        const role: 'admin' | 'user' = u.role === 'admin' ? 'admin' : 'user';
        const txPermission: TxPermission =
          role === 'admin'
            ? 'ALL'
            : (u.txPermission === 'IN_ONLY' || u.txPermission === 'OUT_ONLY' || u.txPermission === 'ALL'
                ? u.txPermission
                : prev?.txPermission || 'OUT_ONLY');
        return {
          id: u.id || `user-${Date.now()}`,
          name: u.name || '',
          password: u.password || prev?.password || '1234',
          role,
          txPermission,
          ...(u.email ? { email: u.email } : {}),
        };
      });

      await USERS_DOC().set({ users: merged });
      logger.info('[users] KDT user list updated', { count: merged.length });
      res.status(200).json({ message: '사용자 목록이 저장되었습니다.', count: merged.length });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logger.error('[users] Error', error);
    res.status(500).json({ error: String(error) });
  }
});
