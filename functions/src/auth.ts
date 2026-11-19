import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getUsersFromDB } from './users';

export const login = onRequest({ cors: true }, async (req, res) => {
  const path = req.path;

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method === 'POST' && path.includes('login')) {
    const { userId, password } = req.body;

    if (!userId || !password) {
      res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
      return;
    }

    let userList;
    try {
      userList = await getUsersFromDB();
    } catch (e) {
      logger.error('[auth] Failed to load users from Firestore', e);
      res.status(500).json({ error: '사용자 정보 조회 실패' });
      return;
    }

    const matchedUser = userList.find((u) => u.id === userId);
    if (!matchedUser || matchedUser.password !== password) {
      res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const token = `${matchedUser.id}-${Date.now()}`;

    try {
      const userRef = admin.firestore().collection('users').doc(matchedUser.id);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        await userRef.set({
          uid: matchedUser.id,
          displayName: matchedUser.name,
          role: matchedUser.role,
          txPermission: matchedUser.txPermission,
          ...(matchedUser.email && { email: matchedUser.email }),
          createdAt: admin.firestore.Timestamp.now(),
          lastLogin: admin.firestore.Timestamp.now(),
        });
      } else {
        await userRef.update({
          role: matchedUser.role,
          txPermission: matchedUser.txPermission,
          lastLogin: admin.firestore.Timestamp.now(),
        });
      }
    } catch (e) {
      logger.warn('[auth] lastLogin update failed (non-fatal)', e);
    }

    logger.info(`[auth] Login: ${userId} (${matchedUser.role}/${matchedUser.txPermission})`);
    res.status(200).json({
      message: 'ok',
      token,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
        txPermission: matchedUser.txPermission,
        password: '',
      },
    });
    return;
  }

  if (req.method === 'POST' && path.includes('check')) {
    const { userId, token } = req.body;
    if (!token || !userId) {
      res.status(200).json({ valid: false, reason: 'no_token' });
      return;
    }
    res.status(200).json({ valid: true });
    return;
  }

  if (req.method === 'POST' && path.includes('logout')) {
    res.status(200).json({ message: 'ok' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
});
