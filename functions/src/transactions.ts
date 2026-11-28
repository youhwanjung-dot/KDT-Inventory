import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { assertZoneWritable, assertZoneWritableInTransaction } from './operationGuards';

const TX_COLLECTION = 'transactions';
const INV_COLLECTION = 'inventory';

// KDT manages all stock & transactions in integer EA (C1 confirmed)
const toInt = (val: unknown): number => Math.round(Number(val) || 0);
const today = (): string => new Date().toISOString().slice(0, 10);
const isCarryOverTx = (tx: any): boolean => String(tx?.reason || '').trim() === '재고이월';
const compareTx = (a: any, b: any): number => {
  const dateDiff = String(a?.date || '').localeCompare(String(b?.date || ''));
  if (dateDiff !== 0) return dateDiff;

  const carryDiff = Number(isCarryOverTx(b)) - Number(isCarryOverTx(a));
  if (carryDiff !== 0) return carryDiff;

  return String(a?.id || '').localeCompare(String(b?.id || ''));
};

const recalculateSnapshots = (txList: any[]): any[] => {
  let runningStock = 0;

  return [...txList]
    .sort(compareTx)
    .map((tx) => {
      const quantity = toInt(tx.quantity);

      if (isCarryOverTx(tx)) {
        runningStock = quantity;
      } else {
        runningStock += tx.type === 'IN' ? quantity : -quantity;
      }

      return {
        ...tx,
        quantity,
        currentStockSnapshot: runningStock,
      };
    });
};

const writeRecalculatedItem = (
  transaction: any,
  db: any,
  itemId: string,
  invDoc: any,
  txDocs: Array<{ ref: any; data: any }>,
  fallbackItem?: any
): number => {
  const recalculated = recalculateSnapshots(txDocs.map((entry) => entry.data));
  const latestTx = recalculated[recalculated.length - 1];
  const finalStock = latestTx ? toInt(latestTx.currentStockSnapshot) : 0;
  const lastUpdated = latestTx?.date || today();

  recalculated.forEach((tx, index) => {
    transaction.set(txDocs[index].ref, tx, { merge: true });
  });

  const invRef = db.collection(INV_COLLECTION).doc(itemId);
  if (invDoc.exists) {
    transaction.update(invRef, {
      currentStock: finalStock,
      lastUpdated,
    });
  } else if (fallbackItem) {
    transaction.set(
      invRef,
      {
        id: itemId,
        name: fallbackItem.itemName || '',
        category: fallbackItem.category || '',
        zoneId: fallbackItem.zoneId || fallbackItem.category || '',
        plating: fallbackItem.plating || '',
        spec: fallbackItem.spec || '',
        unit: 'EA',
        eaPerUnit: 1,
        safeStock: 0,
        currentStock: finalStock,
        lastUpdated,
      },
      { merge: true }
    );
  }

  return finalStock;
};

export const transactions = onRequest({ cors: true }, async (req, res) => {
  const db = admin.firestore();

  try {
    if (req.method === 'GET') {
      const snapshot = await db.collection(TX_COLLECTION).get();
      const txList = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      res.json(txList);
      return;
    }

    if (req.method === 'POST') {
      // 전체 품목 재고 재계산 (서버 즉시 동기화 시 호출)
      if (req.path.replace(/\/$/, '') === '/recalculate-all') {
        const invSnap = await db.collection(INV_COLLECTION).get();
        const itemIds = invSnap.docs.map((doc: any) => doc.id);
        const results: Array<{ itemId: string; currentStock: number }> = [];

        for (const itemId of itemIds) {
          try {
            const invRef = db.collection(INV_COLLECTION).doc(itemId);
            const txQuery = db.collection(TX_COLLECTION).where('itemId', '==', itemId);
            const [invDoc, txSnap] = await Promise.all([invRef.get(), txQuery.get()]);
            const txDocs = txSnap.docs.map((doc: any) => ({ ref: doc.ref, data: { ...doc.data(), id: doc.id } }));

            const recalculated = recalculateSnapshots(txDocs.map((e: any) => e.data));
            const latestTx = recalculated[recalculated.length - 1];
            const finalStock = latestTx ? toInt(latestTx.currentStockSnapshot) : 0;
            const lastUpdated = latestTx?.date || today();

            const batch = db.batch();
            recalculated.forEach((tx, index) => {
              batch.set(txDocs[index].ref, tx, { merge: true });
            });
            if (invDoc.exists) {
              batch.update(invRef, { currentStock: finalStock, lastUpdated });
            }
            await batch.commit();

            results.push({ itemId, currentStock: finalStock });
          } catch (err: any) {
            logger.error('recalculate item failed', { itemId, error: err?.message });
            results.push({ itemId, currentStock: -1 });
          }
        }

        logger.info('recalculate-all done', { total: itemIds.length });
        res.json({ message: 'ok', total: itemIds.length, results });
        return;
      }

      const tx = req.body;
      if (!tx || !tx.itemId) {
        res.status(400).json({ error: 'itemId is required' });
        return;
      }
      await assertZoneWritable(db, [tx.zoneId, tx.category]);

      const txId = tx.id || `TX-${Date.now()}`;
      const qty = toInt(tx.quantity);
      let currentStock = 0;

      await db.runTransaction(async (transaction: any) => {
        await assertZoneWritableInTransaction(transaction, db, [tx.zoneId, tx.category]);
        const txRef = db.collection(TX_COLLECTION).doc(txId);
        const invRef = db.collection(INV_COLLECTION).doc(tx.itemId);
        const invDoc = await transaction.get(invRef);
        const txQuery = db.collection(TX_COLLECTION).where('itemId', '==', tx.itemId);
        const txSnap = await transaction.get(txQuery);

        const nextTx = {
          ...tx,
          id: txId,
          quantity: qty,
          currentStockSnapshot: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const txDocs = txSnap.docs.map((doc: any) => ({ ref: doc.ref, data: { ...doc.data(), id: doc.id } }));
        txDocs.push({ ref: txRef, data: nextTx });
        currentStock = writeRecalculatedItem(transaction, db, tx.itemId, invDoc, txDocs, nextTx);
      });

      logger.info('KDT transaction created', { txId, itemId: tx.itemId, currentStock });
      res.json({ message: 'ok', currentStock });
      return;
    }

    if (req.method === 'PUT') {
      const pathParts = req.path.split('/').filter(Boolean);
      const txId = decodeURIComponent(pathParts[pathParts.length - 1] || '');

      if (!txId || txId === 'transaction') {
        res.status(400).json({ error: 'Transaction ID is required' });
        return;
      }

      const updates = req.body;
      const txRef = db.collection(TX_COLLECTION).doc(txId);

      let currentStock = 0;

      await db.runTransaction(async (transaction: any) => {
        const txDoc = await transaction.get(txRef);
        if (!txDoc.exists) {
          throw Object.assign(new Error('Transaction not found'), { status: 404 });
        }

        const oldTx = txDoc.data()!;
        const newTx = { ...oldTx, ...updates, id: txId, quantity: toInt(updates.quantity ?? oldTx.quantity) };
        await assertZoneWritableInTransaction(transaction, db, [
          oldTx.zoneId,
          oldTx.category,
          newTx.zoneId,
          newTx.category,
        ]);
        await assertZoneWritable(db, [
          oldTx.zoneId,
          oldTx.category,
          newTx.zoneId,
          newTx.category,
        ]);
        const affectedItemIds = Array.from(new Set([oldTx.itemId, newTx.itemId].filter(Boolean)));
        const itemStateMap = new Map<string, { invDoc: any; txDocs: Array<{ ref: any; data: any }> }>();

        for (const itemId of affectedItemIds) {
          const invRef = db.collection(INV_COLLECTION).doc(itemId);
          const txQuery = db.collection(TX_COLLECTION).where('itemId', '==', itemId);
          const [invDoc, txSnap] = await Promise.all([
            transaction.get(invRef),
            transaction.get(txQuery),
          ]);
          itemStateMap.set(itemId, {
            invDoc,
            txDocs: txSnap.docs.map((doc: any) => ({ ref: doc.ref, data: { ...doc.data(), id: doc.id } })),
          });
        }

        for (const itemId of affectedItemIds) {
          const state = itemStateMap.get(itemId);
          if (!state) continue;

          const baseTxDocs = state.txDocs.filter((entry) => entry.ref.path !== txRef.path);
          if (itemId === newTx.itemId) {
            baseTxDocs.push({ ref: txRef, data: { ...newTx, currentStockSnapshot: 0 } });
          }

          const finalStock = writeRecalculatedItem(
            transaction,
            db,
            itemId,
            state.invDoc,
            baseTxDocs,
            newTx
          );

          if (itemId === newTx.itemId) {
            currentStock = finalStock;
          }
        }
      });

      logger.info('KDT transaction updated', { txId, currentStock });
      res.json({ message: 'ok', currentStock });
      return;
    }

    if (req.method === 'DELETE') {
      const pathParts = req.path.split('/').filter(Boolean);
      const txId = decodeURIComponent(pathParts[pathParts.length - 1] || '');

      if (!txId || txId === 'transaction') {
        res.status(400).json({ error: 'Transaction ID is required' });
        return;
      }

      // 트랜잭션 내에서는 where 쿼리를 사용할 수 없으므로 밖에서 대상 ref 확정
      let txRef = db.collection(TX_COLLECTION).doc(txId);
      const directDoc = await txRef.get();
      if (!directDoc.exists) {
        const querySnap = await db.collection(TX_COLLECTION).where('id', '==', txId).limit(1).get();
        if (querySnap.empty) {
          res.status(404).json({ error: 'Transaction not found' });
          return;
        }
        txRef = querySnap.docs[0].ref;
      }

      let currentStock = 0;

      await db.runTransaction(async (transaction: any) => {
        const txDoc = await transaction.get(txRef);
        if (!txDoc.exists) {
          throw Object.assign(new Error('Transaction not found'), { status: 404 });
        }

        const tx = txDoc.data()!;
        await assertZoneWritableInTransaction(transaction, db, [tx.zoneId, tx.category]);
        await assertZoneWritable(db, [tx.zoneId, tx.category]);
        const invRef = db.collection(INV_COLLECTION).doc(tx.itemId);
        const txQuery = db.collection(TX_COLLECTION).where('itemId', '==', tx.itemId);
        const [invDoc, txSnap] = await Promise.all([
          transaction.get(invRef),
          transaction.get(txQuery),
        ]);

        const txDocs = txSnap.docs
          .map((doc: any) => ({ ref: doc.ref, data: { ...doc.data(), id: doc.id } }))
          .filter((entry: any) => entry.ref.path !== txRef.path);

        currentStock = writeRecalculatedItem(transaction, db, tx.itemId, invDoc, txDocs, tx);

        transaction.delete(txRef);
      });

      logger.info('KDT transaction deleted', { txId, currentStock });
      res.json({ message: 'ok', currentStock });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error && error.status === 404) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    logger.error('Transaction error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
