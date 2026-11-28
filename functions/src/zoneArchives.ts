import { getAdmin } from './adminApp';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { requireAdminSession } from './operationGuards';

const admin: any = new Proxy({}, { get: (_target, property) => getAdmin()[property] });
const ARCHIVE_COLLECTION = 'zoneArchives';
const CONTROL_COLLECTION = 'zoneControl';
const BATCH_SIZE = 400;

const toInt = (value: unknown): number => Math.round(Number(value) || 0);
const isCarryOver = (tx: any): boolean => String(tx?.reason || '').trim() === '재고이월';
const compareTransactions = (a: any, b: any): number => {
  const byDate = String(a?.date || '').localeCompare(String(b?.date || ''));
  if (byDate) return byDate;
  const byCarry = Number(isCarryOver(b)) - Number(isCarryOver(a));
  return byCarry || String(a?.id || '').localeCompare(String(b?.id || ''));
};

const calculatedBalance = (transactions: any[]): number =>
  [...transactions].sort(compareTransactions).reduce((balance, tx) => {
    const quantity = toInt(tx.quantity);
    if (isCarryOver(tx)) return quantity;
    return balance + (tx.type === 'IN' ? quantity : -quantity);
  }, 0);

const writeDocuments = async (db: any, entries: Array<{ ref: any; data: any }>) => {
  for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
    const batch = db.batch();
    entries.slice(offset, offset + BATCH_SIZE).forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
};

const deleteDocuments = async (db: any, refs: any[]) => {
  for (let offset = 0; offset < refs.length; offset += BATCH_SIZE) {
    const batch = db.batch();
    refs.slice(offset, offset + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

const documents = async (collection: any) => {
  const snapshot = await collection.get();
  return snapshot.docs.map((doc: any) => ({ ref: doc.ref, id: doc.id, data: doc.data() }));
};

const removeZoneFromMasterData = async (db: any, header: any) => {
  const ref = db.collection('masterData').doc('custom');
  const snapshot = await ref.get();
  if (!snapshot.exists) return;

  const current = snapshot.data() || {};
  const zoneNames = new Set<string>(header.categoryAliases || []);
  zoneNames.add(String(header.displayName || ''));
  const categories = (Array.isArray(current.categories) ? current.categories : [])
    .filter((name: string) => !zoneNames.has(name));
  const namesByCategory = { ...(current.namesByCategory || {}) };
  zoneNames.forEach((name) => delete namesByCategory[name]);

  const stillUsedNames = new Set<string>(
    Object.values(namesByCategory).flatMap((names: any) => Array.isArray(names) ? names : [])
  );
  const archivedNames = new Set<string>((header.masterDataForRestore?.nameOrder || []).map(String));
  Object.values(header.masterDataForRestore?.namesByCategory || {}).forEach((names: any) => {
    if (Array.isArray(names)) names.forEach((name) => archivedNames.add(String(name)));
  });
  const nameOrder = (Array.isArray(current.nameOrder) ? current.nameOrder : [])
    .filter((name: string) => !archivedNames.has(name) || stillUsedNames.has(name));
  const zoneMeta = { ...(current.zoneMeta || {}) };
  Object.entries(zoneMeta).forEach(([key, meta]: [string, any]) => {
    if (key === header.zoneId || meta?.zoneId === header.zoneId ||
        zoneNames.has(String(meta?.displayName || ''))) {
      delete zoneMeta[key];
    }
  });

  await ref.set({
    categories,
    namesByCategory,
    nameOrder,
    zoneMeta,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
};

const restoreZoneToMasterData = async (db: any, header: any) => {
  const snapshotData = header.masterDataForRestore || {};
  const ref = db.collection('masterData').doc('custom');
  const snapshot = await ref.get();
  const current = snapshot.exists ? snapshot.data() || {} : {};
  const categories = new Set<string>(Array.isArray(current.categories) ? current.categories : []);
  (snapshotData.categories || []).forEach((name: string) => categories.add(name));

  const namesByCategory = { ...(current.namesByCategory || {}) };
  Object.entries(snapshotData.namesByCategory || {}).forEach(([category, names]) => {
    const merged = new Set<string>([
      ...(Array.isArray(namesByCategory[category]) ? namesByCategory[category] : []),
      ...(Array.isArray(names) ? names as string[] : []),
    ]);
    namesByCategory[category] = Array.from(merged);
  });
  const nameOrder = new Set<string>(Array.isArray(current.nameOrder) ? current.nameOrder : []);
  (snapshotData.nameOrder || []).forEach((name: string) => nameOrder.add(name));
  const zoneMeta = { ...(current.zoneMeta || {}), ...(snapshotData.zoneMeta || {}) };

  return {
    ref,
    data: {
      categories: Array.from(categories),
      namesByCategory,
      nameOrder: Array.from(nameOrder),
      zoneMeta,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
};

export const zoneArchives = onRequest({ cors: true, timeoutSeconds: 540, memory: '1GiB' }, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const db = admin.firestore();
  const requestParts = req.path.split('/').filter(Boolean);
  const pathParts = requestParts[0] === 'api' && requestParts[1] === 'zone-archives'
    ? requestParts.slice(2)
    : requestParts;

  try {
    if (req.method === 'GET') {
      if (pathParts.length === 0) {
        const all = await documents(db.collection(ARCHIVE_COLLECTION));
        const summaries = all
          .map(({ id, data }: any) => ({ id, ...data }))
          .filter((archive: any) => archive.status === 'ARCHIVED' || archive.status === 'RESTORED')
          .sort((a: any, b: any) => {
            const timestamp = (value: any) =>
              Number(value?._seconds || value?.seconds || 0) || new Date(value || 0).getTime();
            return timestamp(b.archivedAt) - timestamp(a.archivedAt);
          });
        res.json(summaries);
        return;
      }

      const archiveId = decodeURIComponent(pathParts[0]);
      const archiveRef = db.collection(ARCHIVE_COLLECTION).doc(archiveId);
      const archiveDoc = await archiveRef.get();
      if (!archiveDoc.exists) {
        res.status(404).json({ error: 'ZONE 아카이브를 찾을 수 없습니다.' });
        return;
      }
      const header = archiveDoc.data() || {};
      if (header.status !== 'ARCHIVED' && header.status !== 'RESTORED') {
        res.status(409).json({ error: '아카이브가 아직 완료되지 않았습니다.' });
        return;
      }
      const [inventory, transactions] = await Promise.all([
        documents(archiveRef.collection('inventory')),
        documents(archiveRef.collection('transactions')),
      ]);
      res.json({
        ...header,
        id: archiveId,
        inventory: inventory.map(({ id, data }: any) => ({ ...data, id })),
        transactions: transactions.map(({ id, data }: any) => ({ ...data, id })),
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    await requireAdminSession(db, req.body);
    const action = String(req.body?.action || '');

    if (action === 'importBackup') {
      const archive = req.body?.archive;
      if (!archive || !/^[A-Za-z0-9_-]+$/.test(String(archive.id || '')) ||
          !Array.isArray(archive.inventory) || !Array.isArray(archive.transactions) ||
          !['ARCHIVED', 'RESTORED'].includes(archive.status)) {
        res.status(400).json({ error: '아카이브 백업 형식이 올바르지 않습니다.' });
        return;
      }
      const archiveRef = db.collection(ARCHIVE_COLLECTION).doc(archive.id);
      const [oldItems, oldTransactions] = await Promise.all([
        documents(archiveRef.collection('inventory')),
        documents(archiveRef.collection('transactions')),
      ]);
      const incomingItemIds = new Set(archive.inventory.map((item: any) => String(item.id || '')));
      const incomingTransactionIds = new Set(archive.transactions.map((tx: any) => String(tx.id || '')));
      await deleteDocuments(db, oldItems.filter(({ id }: any) => !incomingItemIds.has(id)).map(({ ref }: any) => ref));
      await deleteDocuments(db, oldTransactions.filter(({ id }: any) => !incomingTransactionIds.has(id)).map(({ ref }: any) => ref));

      await writeDocuments(db, archive.inventory.map((item: any) => ({
        ref: archiveRef.collection('inventory').doc(String(item.id)),
        data: item,
      })));
      await writeDocuments(db, archive.transactions.map((tx: any) => ({
        ref: archiveRef.collection('transactions').doc(String(tx.id)),
        data: tx,
      })));
      const header = { ...archive };
      delete header.inventory;
      delete header.transactions;
      await archiveRef.set({
        ...header,
        itemCount: archive.inventory.length,
        transactionCount: archive.transactions.length,
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const controlRef = db.collection(CONTROL_COLLECTION).doc(encodeURIComponent(String(archive.zoneId)));
      if (archive.status === 'ARCHIVED') {
        await controlRef.set({
          zoneId: archive.zoneId,
          displayName: archive.displayName,
          categoryAliases: archive.categoryAliases || [archive.displayName],
          status: 'ARCHIVED',
          archiveId: archive.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const controlDoc = await controlRef.get();
        if (controlDoc.data()?.archiveId === archive.id) {
          await controlRef.set({
            zoneId: archive.zoneId,
            displayName: archive.displayName,
            categoryAliases: archive.categoryAliases || [archive.displayName],
            status: 'ACTIVE',
            archiveId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      res.json({
        message: 'ok',
        archiveId: archive.id,
        itemCount: archive.inventory.length,
        transactionCount: archive.transactions.length,
      });
      return;
    }

    if (action === 'finalizeBackupImport') {
      if (!Array.isArray(req.body?.archiveIds) ||
          !req.body.archiveIds.every((id: unknown) => typeof id === 'string')) {
        res.status(400).json({ error: '아카이브 ID 목록이 필요합니다.' });
        return;
      }
      const keepIds = new Set<string>(req.body.archiveIds);
      const currentArchives = await documents(db.collection(ARCHIVE_COLLECTION));
      const remove = currentArchives.filter(({ id }: any) => !keepIds.has(id));
      for (const { id, ref, data } of remove as any[]) {
        const controlRef = db.collection(CONTROL_COLLECTION).doc(encodeURIComponent(String(data.zoneId || '')));
        const controlDoc = await controlRef.get();
        if (['ARCHIVING', 'RESTORING'].includes(String(controlDoc.data()?.status || ''))) {
          res.status(409).json({ error: `${data.displayName || data.zoneId} ZONE 작업 중에는 백업 복구를 완료할 수 없습니다.` });
          return;
        }
        const [items, transactions] = await Promise.all([
          documents(ref.collection('inventory')),
          documents(ref.collection('transactions')),
        ]);
        await deleteDocuments(db, [...items, ...transactions].map((entry: any) => entry.ref));
        await ref.delete();
        if (controlDoc.data()?.archiveId === id) {
          await controlRef.set({
            zoneId: data.zoneId,
            displayName: data.displayName,
            categoryAliases: data.categoryAliases || [data.displayName],
            status: 'ACTIVE',
            archiveId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      res.json({ message: 'ok', removedArchives: remove.length });
      return;
    }

    if (action === 'archive') {
      const zoneId = String(req.body?.zoneId || '').trim();
      const displayName = String(req.body?.displayName || '').trim();
      if (!zoneId || !displayName) {
        res.status(400).json({ error: 'ZONE ID와 표시명이 필요합니다.' });
        return;
      }

      const masterDocForLock = await db.collection('masterData').doc('custom').get();
      const masterDataForLock = masterDocForLock.exists ? masterDocForLock.data() || {} : {};
      const zoneMetaForLock = masterDataForLock.zoneMeta?.[zoneId] || {};
      const categoryAliases = Array.from(new Set<string>([
        displayName,
        ...(Array.isArray(zoneMetaForLock.aliasHistory)
          ? zoneMetaForLock.aliasHistory.map((entry: any) => String(entry.name || ''))
          : []),
      ].filter(Boolean)));
      const controlRef = db.collection(CONTROL_COLLECTION).doc(encodeURIComponent(zoneId));
      const newArchiveRef = db.collection(ARCHIVE_COLLECTION).doc();
      const lock = await db.runTransaction(async (transaction: any) => {
        const controlDoc = await transaction.get(controlRef);
        const control = controlDoc.data() || {};
        if (control.status === 'ARCHIVED') {
          throw Object.assign(new Error('이미 마감된 ZONE입니다.'), { status: 409 });
        }
        if (control.status === 'RESTORING') {
          throw Object.assign(new Error('ZONE 복구 작업 중에는 마감할 수 없습니다.'), { status: 409 });
        }
        if (control.status === 'ARCHIVING' && control.archiveId) {
          return { archiveId: control.archiveId, isResume: true };
        }
        transaction.set(controlRef, {
          zoneId,
          displayName,
          categoryAliases,
          status: 'ARCHIVING',
          archiveId: newArchiveRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { archiveId: newArchiveRef.id, isResume: false };
      });

      const archiveRef = db.collection(ARCHIVE_COLLECTION).doc(lock.archiveId);
      let deletionStarted = false;
      try {
        const archiveDoc = await archiveRef.get();
        let header = archiveDoc.exists ? archiveDoc.data() || {} : null;
        let archivedItems = await documents(archiveRef.collection('inventory'));
        let archivedTransactions = await documents(archiveRef.collection('transactions'));
        const expectedCountsMatch = header &&
          archivedItems.length === Number(header.itemCount) &&
          archivedTransactions.length === Number(header.transactionCount);

        if (!lock.isResume || !expectedCountsMatch) {
          if (lock.isResume) {
            throw new Error('중단된 아카이브 사본 검증에 실패했습니다. 활성 데이터는 보존되어 있으며 관리자 확인이 필요합니다.');
          }

          const [inventoryRows, transactionRows] = await Promise.all([
            documents(db.collection('inventory')),
            documents(db.collection('transactions')),
          ]);
          const masterData = masterDataForLock;
          const zoneMeta = zoneMetaForLock;
          const aliasSet = new Set(categoryAliases);
          const zoneItems = inventoryRows.filter(({ data }: any) =>
            String(data.zoneId || data.category || '') === zoneId ||
            aliasSet.has(String(data.category || ''))
          );
          const zoneItemIds = new Set(zoneItems.map(({ id }: any) => id));
          const zoneTransactions = transactionRows.filter(({ data }: any) =>
            zoneItemIds.has(String(data.itemId || '')) ||
            String(data.zoneId || '') === zoneId ||
            aliasSet.has(String(data.category || ''))
          );

          const nonZeroItems = zoneItems
            .filter(({ data }: any) => toInt(data.currentStock) !== 0)
            .map(({ id, data }: any) => ({ id, name: data.name, currentStock: toInt(data.currentStock) }));
          if (nonZeroItems.length > 0) {
            throw Object.assign(
              new Error(`현재고가 0이 아닌 품목이 ${nonZeroItems.length}개입니다. 먼저 수량을 반납·이관 정산해 주세요.`),
              { status: 409, details: nonZeroItems }
            );
          }

          const mismatchItems = zoneItems.flatMap(({ id, data }: any) => {
            const history = zoneTransactions
              .filter(({ data: tx }: any) => String(tx.itemId || '') === id)
              .map(({ id: txId, data: tx }: any) => ({ ...tx, id: txId }));
            const expectedStock = calculatedBalance(history);
            const currentStock = toInt(data.currentStock);
            return expectedStock === currentStock
              ? []
              : [{ id, name: data.name, currentStock, historyStock: expectedStock }];
          });
          if (mismatchItems.length > 0) {
            throw Object.assign(
              new Error(`수불 이력과 현재고가 맞지 않는 품목이 ${mismatchItems.length}개입니다. 정합화 후 다시 마감해 주세요.`),
              { status: 409, details: mismatchItems }
            );
          }
          if (zoneItems.length === 0 && zoneTransactions.length === 0) {
            throw Object.assign(new Error('마감 대상 ZONE의 품목과 수불 이력을 찾을 수 없습니다.'), { status: 404 });
          }

          const displayItemIds = new Set(zoneItems.map(({ id }: any) => id));
          const masterNames = Array.from(new Set<string>([
            ...(Array.isArray(masterData.namesByCategory?.[displayName])
              ? masterData.namesByCategory[displayName]
              : []),
            ...zoneItems.map(({ data }: any) => String(data.name || '')).filter(Boolean),
          ]));
          const orderedZoneNames = (Array.isArray(masterData.nameOrder) ? masterData.nameOrder : [])
            .filter((name: string) => masterNames.includes(name));
          const masterDataForRestore = {
            categories: [displayName],
            namesByCategory: masterNames.length ? { [displayName]: masterNames } : {},
            nameOrder: orderedZoneNames,
            zoneMeta: masterData.zoneMeta?.[zoneId] ? { [zoneId]: masterData.zoneMeta[zoneId] } : {},
          };
          header = {
            zoneId,
            displayName,
            categoryAliases,
            status: 'ARCHIVING',
            itemCount: zoneItems.length,
            transactionCount: zoneTransactions.length,
            orphanTransactionCount: zoneTransactions.filter(({ data }: any) => !displayItemIds.has(String(data.itemId || ''))).length,
            archivedBy: String(req.body?.userId || ''),
            masterDataForRestore,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          await archiveRef.set(header);

          await writeDocuments(
            db,
            zoneItems.map(({ id, data }: any) => ({
              ref: archiveRef.collection('inventory').doc(id),
              data: { ...data, id },
            }))
          );
          await writeDocuments(
            db,
            zoneTransactions.map(({ id, data }: any) => ({
              ref: archiveRef.collection('transactions').doc(id),
              data: { ...data, id },
            }))
          );
          archivedItems = await documents(archiveRef.collection('inventory'));
          archivedTransactions = await documents(archiveRef.collection('transactions'));
          if (archivedItems.length !== zoneItems.length || archivedTransactions.length !== zoneTransactions.length) {
            throw new Error('아카이브 복사 건수 검증에 실패했습니다. 활성 DB는 삭제하지 않았습니다.');
          }
        }

        const archivedItemIds = new Set(archivedItems.map(({ id }: any) => id));
        const archivedTransactionIds = new Set(archivedTransactions.map(({ id }: any) => id));
        const currentInventoryRows = await documents(db.collection('inventory'));
        const currentTransactionRows = await documents(db.collection('transactions'));
        const inventoryRefs = currentInventoryRows
          .filter(({ id }: any) => archivedItemIds.has(id))
          .map(({ ref }: any) => ref);
        const transactionRefs = currentTransactionRows
          .filter(({ id }: any) => archivedTransactionIds.has(id))
          .map(({ ref }: any) => ref);

        deletionStarted = true;
        await deleteDocuments(db, transactionRefs);
        await deleteDocuments(db, inventoryRefs);
        await removeZoneFromMasterData(db, header);
        await archiveRef.update({
          status: 'ARCHIVED',
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: admin.firestore.FieldValue.delete(),
        });
        await controlRef.set({
          zoneId,
          displayName,
          categoryAliases: header.categoryAliases || categoryAliases,
          status: 'ARCHIVED',
          archiveId: archiveRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
          message: 'ok',
          archiveId: archiveRef.id,
          itemCount: archivedItems.length,
          transactionCount: archivedTransactions.length,
          orphanTransactionCount: Number(header.orphanTransactionCount || 0),
        });
      } catch (error: any) {
        const partialArchiveExists = await headerOrArchiveExists(archiveRef);
        if (deletionStarted && partialArchiveExists) {
          await archiveRef.set({
            status: 'ARCHIVING',
            lastError: String(error?.message || error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }).catch(() => undefined);
        }
        if (!deletionStarted) {
          if (partialArchiveExists) {
            const [partialItems, partialTransactions] = await Promise.all([
              documents(archiveRef.collection('inventory')),
              documents(archiveRef.collection('transactions')),
            ]);
            await deleteDocuments(db, [...partialItems, ...partialTransactions].map(({ ref }: any) => ref))
              .catch(() => undefined);
            await archiveRef.delete().catch(() => undefined);
          }
          await controlRef.set({
            zoneId,
            displayName,
            categoryAliases,
            status: 'ACTIVE',
            archiveId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => undefined);
        }
        throw error;
      }
      return;
    }

    if (action === 'restore') {
      const archiveId = String(req.body?.archiveId || '').trim();
      if (!archiveId) {
        res.status(400).json({ error: '아카이브 ID가 필요합니다.' });
        return;
      }
      const archiveRef = db.collection(ARCHIVE_COLLECTION).doc(archiveId);
      const archiveDoc = await archiveRef.get();
      if (!archiveDoc.exists) {
        res.status(404).json({ error: 'ZONE 아카이브를 찾을 수 없습니다.' });
        return;
      }
      const header = archiveDoc.data() || {};
      if (header.status !== 'ARCHIVED') {
        res.status(409).json({ error: '현재 상태에서는 ZONE을 복구할 수 없습니다.' });
        return;
      }

      const controlRef = db.collection(CONTROL_COLLECTION).doc(encodeURIComponent(header.zoneId));
      await db.runTransaction(async (transaction: any) => {
        const controlDoc = await transaction.get(controlRef);
        const control = controlDoc.data() || {};
        if (control.status === 'ARCHIVING' || control.status === 'RESTORING') {
          throw Object.assign(new Error('ZONE 작업이 진행 중입니다.'), { status: 409 });
        }
        transaction.set(controlRef, {
          zoneId: header.zoneId,
          displayName: header.displayName,
          categoryAliases: header.categoryAliases || [header.displayName],
          status: 'RESTORING',
          archiveId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      let restoreWritesStarted = false;
      let restoreInventoryRows: any[] = [];
      let restoreTransactionRows: any[] = [];
      try {
        [restoreInventoryRows, restoreTransactionRows] = await Promise.all([
          documents(archiveRef.collection('inventory')),
          documents(archiveRef.collection('transactions')),
        ]);
        const [activeInventory, activeTransactions] = await Promise.all([
          db.collection('inventory').get(),
          db.collection('transactions').get(),
        ]);
        const activeItemIds = new Set(activeInventory.docs.map((doc: any) => doc.id));
        const activeTransactionIds = new Set(activeTransactions.docs.map((doc: any) => doc.id));
        if (restoreInventoryRows.some(({ id }: any) => activeItemIds.has(id)) ||
            restoreTransactionRows.some(({ id }: any) => activeTransactionIds.has(id))) {
          throw Object.assign(new Error('복구 대상 ID가 활성 DB에 이미 존재합니다. 중복 데이터를 확인해 주세요.'), { status: 409 });
        }

        restoreWritesStarted = true;
        await writeDocuments(db, restoreInventoryRows.map(({ id, data }: any) => ({
          ref: db.collection('inventory').doc(id),
          data: { ...data, id },
        })));
        await writeDocuments(db, restoreTransactionRows.map(({ id, data }: any) => ({
          ref: db.collection('transactions').doc(id),
          data: { ...data, id },
        })));
        const masterDataRestore = await restoreZoneToMasterData(db, header);
        const finalizeBatch = db.batch();
        finalizeBatch.set(masterDataRestore.ref, masterDataRestore.data, { merge: true });
        finalizeBatch.update(archiveRef, {
          status: 'RESTORED',
          restoredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        finalizeBatch.set(controlRef, {
          zoneId: header.zoneId,
          displayName: header.displayName,
          categoryAliases: header.categoryAliases || [header.displayName],
          status: 'ACTIVE',
          archiveId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await finalizeBatch.commit();
        res.json({
          message: 'ok',
          itemCount: restoreInventoryRows.length,
          transactionCount: restoreTransactionRows.length,
        });
      } catch (error) {
        if (restoreWritesStarted) {
          await deleteDocuments(db, [
            ...restoreInventoryRows.map(({ id }: any) => db.collection('inventory').doc(id)),
            ...restoreTransactionRows.map(({ id }: any) => db.collection('transactions').doc(id)),
          ]).catch(() => undefined);
        }
        await archiveRef.set({
          status: 'ARCHIVED',
          restoredAt: admin.firestore.FieldValue.delete(),
        }, { merge: true }).catch(() => undefined);
        await controlRef.set({
          zoneId: header.zoneId,
          displayName: header.displayName,
          categoryAliases: header.categoryAliases || [header.displayName],
          status: 'ARCHIVED',
          archiveId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => undefined);
        throw error;
      }
      return;
    }

    res.status(400).json({ error: '지원하지 않는 작업입니다.' });
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    if (status >= 500) logger.error('ZONE archive operation failed', error);
    res.status(status).json({
      error: error?.message || 'ZONE 아카이브 처리에 실패했습니다.',
      details: error?.details,
    });
  }
});

async function headerOrArchiveExists(archiveRef: any): Promise<boolean> {
  const snapshot = await archiveRef.get();
  return snapshot.exists;
}
