export interface SessionIdentity {
  userId: string;
  token: string;
}

export async function requireAdminSession(db: any, identity: SessionIdentity): Promise<void> {
  if (!identity?.userId || !identity?.token) {
    throw Object.assign(new Error('관리자 로그인이 필요합니다.'), { status: 401 });
  }

  const userDoc = await db.collection('users').doc(identity.userId).get();
  const user = userDoc.data();
  if (!userDoc.exists || user?.activeToken !== identity.token) {
    throw Object.assign(new Error('세션이 만료되었습니다. 다시 로그인해 주세요.'), { status: 401 });
  }
  if (user?.role !== 'admin') {
    throw Object.assign(new Error('관리자 권한이 필요합니다.'), { status: 403 });
  }
}

export async function assertZoneWritable(
  db: any,
  identifiers: Array<string | undefined | null>
): Promise<void> {
  const keys = Array.from(new Set(identifiers.map((value) => String(value || '').trim()).filter(Boolean)));
  for (const key of keys) {
    const controlDoc = await db.collection('zoneControl').doc(encodeURIComponent(key)).get();
    const status = controlDoc.data()?.status;
    if (status && status !== 'ACTIVE') {
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
  }
  for (let offset = 0; offset < keys.length; offset += 30) {
    const snapshot = await db.collection('zoneControl')
      .where('displayName', 'in', keys.slice(offset, offset + 30))
      .get();
    const locked = snapshot.docs.find((doc: any) => doc.data()?.status && doc.data().status !== 'ACTIVE');
    if (locked) {
      const status = locked.data().status;
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
    const aliasSnapshot = await db.collection('zoneControl')
      .where('categoryAliases', 'array-contains-any', keys.slice(offset, offset + 30))
      .get();
    const aliasLock = aliasSnapshot.docs.find((doc: any) => doc.data()?.status && doc.data().status !== 'ACTIVE');
    if (aliasLock) {
      const status = aliasLock.data().status;
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
  }
}

export async function assertZoneWritableInTransaction(
  transaction: any,
  db: any,
  identifiers: Array<string | undefined | null>
): Promise<void> {
  const keys = Array.from(new Set(identifiers.map((value) => String(value || '').trim()).filter(Boolean)));
  for (const key of keys) {
    const controlRef = db.collection('zoneControl').doc(encodeURIComponent(key));
    const controlDoc = await transaction.get(controlRef);
    const status = controlDoc.data()?.status;
    if (status && status !== 'ACTIVE') {
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
  }
  for (let offset = 0; offset < keys.length; offset += 30) {
    const snapshot = await transaction.get(
      db.collection('zoneControl').where('displayName', 'in', keys.slice(offset, offset + 30))
    );
    const locked = snapshot.docs.find((doc: any) => doc.data()?.status && doc.data().status !== 'ACTIVE');
    if (locked) {
      const status = locked.data().status;
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
    const aliasSnapshot = await transaction.get(
      db.collection('zoneControl')
        .where('categoryAliases', 'array-contains-any', keys.slice(offset, offset + 30))
    );
    const aliasLock = aliasSnapshot.docs.find((doc: any) => doc.data()?.status && doc.data().status !== 'ACTIVE');
    if (aliasLock) {
      const status = aliasLock.data().status;
      throw Object.assign(
        new Error(status === 'ARCHIVED' ? '마감된 ZONE은 수정할 수 없습니다.' : 'ZONE 마감 처리 중입니다.'),
        { status: 409 }
      );
    }
  }
}
