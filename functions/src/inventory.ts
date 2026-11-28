import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import {
  assertZoneWritableInTransaction,
  requireAdminSession,
} from './operationGuards';

const COLLECTION = 'inventory';
const toInt = (val: unknown): number => Math.round(Number(val) || 0);

export const inventory = onRequest({ cors: true }, async (req, res) => {
  const db = admin.firestore();

  try {
    if (req.method === 'GET') {
      const snapshot = await db.collection(COLLECTION).get();
      const items = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      res.json(items);
      return;
    }

    if (req.method === 'POST') {
      const item = req.body;
      if (item?.action === 'deleteExcludedItems') {
        await requireAdminSession(db, item);
        const itemIds: string[] = Array.isArray(item.itemIds)
          ? Array.from(new Set<string>(item.itemIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)))
          : [];
        if (itemIds.length === 0 || itemIds.length > 50) {
          res.status(400).json({ error: '영구삭제할 품목 ID를 1~50개 지정해 주세요.' });
          return;
        }

        let deletedTransactions = 0;
        await db.runTransaction(async (transaction: any) => {
          const itemRefs = itemIds.map((id: string) => db.collection(COLLECTION).doc(id));
          const itemDocs = await transaction.getAll(...itemRefs);
          if (itemDocs.some((doc: any) => !doc.exists)) {
            throw Object.assign(new Error('삭제 대상 중 DB에서 찾을 수 없는 품목이 있습니다.'), { status: 404 });
          }

          const itemRecords = itemDocs.map((doc: any) => ({ id: doc.id, data: doc.data() || {} }));
          for (const { data } of itemRecords) {
            if (toInt(data.currentStock) !== 0) {
              throw Object.assign(new Error('현재고가 0이 아닌 품목이 포함되어 있습니다. 병합 또는 정산해 주세요.'), { status: 409 });
            }
            await assertZoneWritableInTransaction(transaction, db, [data.zoneId, data.category]);
          }

          const txSnapshots = await Promise.all(itemIds.map((id: string) =>
            transaction.get(db.collection('transactions').where('itemId', '==', id))
          ));
          const transactionDocs = txSnapshots.flatMap((snapshot: any) => snapshot.docs);
          if (transactionDocs.length + itemRecords.length * 2 > 500) {
            throw Object.assign(
              new Error('연결된 수불 이력이 단일 안전 삭제 한도를 넘었습니다. 개별 품목으로 나누어 처리해 주세요.'),
              { status: 409 }
            );
          }

          deletedTransactions = transactionDocs.length;
          transactionDocs.forEach((doc: any) => transaction.delete(doc.ref));
          itemRecords.forEach(({ id, data }: any) => {
            transaction.delete(db.collection(COLLECTION).doc(id));
            transaction.set(db.collection('auditLogs').doc(), {
              action: 'INVENTORY_PERMANENT_DELETE',
              status: 'COMPLETED',
              itemId: id,
              itemSnapshot: {
                name: data.name || '',
                category: data.category || '',
                zoneId: data.zoneId || data.category || '',
                plating: data.plating || '',
                spec: data.spec || '',
                currentStock: toInt(data.currentStock),
              },
              transactionCount: txSnapshots[itemIds.indexOf(id)].size,
              requestedBy: String(item.userId || ''),
              reason: '중복 관리에서 관리제외 품목 영구삭제',
              requestedAt: admin.firestore.FieldValue.serverTimestamp(),
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
        });
        res.json({ message: 'ok', deletedItems: itemIds.length, deletedTransactions });
        return;
      }
      if (!item || !item.name) {
        res.status(400).json({ error: 'Item name is required' });
        return;
      }

      const docId = item.id || db.collection(COLLECTION).doc().id;
      const payload = {
        ...item,
        id: docId,
        zoneId: item.zoneId || item.category || '',
        plating: item.plating ?? '',
        spec: item.spec ?? '',
        unit: item.unit || 'EA',
        eaPerUnit: Math.max(1, toInt(item.eaPerUnit ?? 1)),
        qtyPerProduct: item.qtyPerProduct !== undefined && item.qtyPerProduct !== '' ? Number(item.qtyPerProduct) || 0 : 0,
        setGroup: item.setGroup ?? '',
        currentStock: toInt(item.currentStock),
        safeStock: toInt(item.safeStock),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};
      const itemRef = db.collection(COLLECTION).doc(docId);
      await db.runTransaction(async (transaction: any) => {
        const existingDoc = await transaction.get(itemRef);
        const existing = existingDoc.exists ? existingDoc.data() || {} : {};
        await assertZoneWritableInTransaction(transaction, db, [
          existing.zoneId,
          existing.category,
          item.zoneId,
          item.category,
        ]);
        transaction.set(itemRef, payload, { merge: true });
      });
      logger.info('KDT inventory item saved', { docId, category: item.category, name: item.name });
      res.json({ message: 'ok', id: docId });
      return;
    }

    if (req.method === 'DELETE') {
      const pathParts = req.path.split('/').filter(Boolean);
      const itemId = decodeURIComponent(pathParts[pathParts.length - 1] || '');

      if (!itemId || itemId === 'inventory') {
        res.status(400).json({ error: 'Item ID is required' });
        return;
      }

      await requireAdminSession(db, req.body);
      const docRef = db.collection(COLLECTION).doc(itemId);
      const auditRef = db.collection('auditLogs').doc();
      let deletedTransactions = 0;
      let deletedItem: any = null;
      await db.runTransaction(async (transaction: any) => {
        const doc = await transaction.get(docRef);
        if (!doc.exists) throw Object.assign(new Error('Item not found in database'), { status: 404 });
        const item = doc.data() || {};
        deletedItem = item;
        if (toInt(item.currentStock) !== 0) {
          throw Object.assign(new Error('현재고가 0인 품목만 영구삭제할 수 있습니다.'), { status: 409 });
        }
        await assertZoneWritableInTransaction(transaction, db, [item.zoneId, item.category]);

        const txSnapshot = await transaction.get(
          db.collection('transactions').where('itemId', '==', itemId)
        );
        if (txSnapshot.size > 498) {
          throw Object.assign(
            new Error('연결된 수불 이력이 498건을 초과해 단일 안전 삭제 한도를 넘었습니다. 관리자에게 문의해 주세요.'),
            { status: 409 }
          );
        }
        deletedTransactions = txSnapshot.size;
        txSnapshot.docs.forEach((txDoc: any) => transaction.delete(txDoc.ref));
        transaction.delete(docRef);
        transaction.set(auditRef, {
          action: 'INVENTORY_PERMANENT_DELETE',
          status: 'COMPLETED',
          itemId,
          itemSnapshot: {
            name: item.name || '',
            category: item.category || '',
            zoneId: item.zoneId || item.category || '',
            plating: item.plating || '',
            spec: item.spec || '',
            currentStock: toInt(item.currentStock),
          },
          transactionCount: txSnapshot.size,
          requestedBy: String(req.body?.userId || ''),
          reason: String(req.body?.reason || '관리제외 품목 영구삭제'),
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      logger.info('KDT inventory item permanently deleted', {
        itemId,
        itemName: deletedItem?.name,
        deletedTransactions,
      });
      res.json({ message: 'ok', deletedTransactions });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    logger.error('Inventory error', error);
    res.status(Number(error?.status) || 500).json({ error: error?.message || 'Internal server error' });
  }
});
