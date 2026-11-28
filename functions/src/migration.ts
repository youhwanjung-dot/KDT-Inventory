import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { assertZoneWritable } from './operationGuards';

const toInt = (val: unknown): number => Math.round(Number(val) || 0);

async function deleteDocsInChunks(
  db: any,
  docs: any[]
) {
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export const migration = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const db = admin.firestore();
  const {
    inventory,
    transactions = [],
    masterData: incomingMasterData,
  } = req.body;

  if (!Array.isArray(inventory) || !Array.isArray(transactions)) {
    res.status(400).json({ error: 'inventory and transactions arrays are required' });
    return;
  }

  try {
    const inventoryIds = new Set<string>();
    for (const item of inventory) {
      const itemId = String(item?.id || '').trim();
      if (!itemId || inventoryIds.has(itemId)) {
        res.status(400).json({ error: `Missing or duplicate inventory ID: ${itemId || '(empty)'}` });
        return;
      }
      if (!Number.isFinite(Number(item.currentStock))) {
        res.status(400).json({ error: `Invalid currentStock for inventory ${itemId}` });
        return;
      }
      inventoryIds.add(itemId);
    }

    const transactionIds = new Set<string>();
    for (const tx of transactions) {
      const txId = String(tx?.id || '').trim();
      const itemId = String(tx?.itemId || '').trim();
      if (!txId || transactionIds.has(txId)) {
        res.status(400).json({ error: `Missing or duplicate transaction ID: ${txId || '(empty)'}` });
        return;
      }
      // 품목 삭제 시 거래 이력은 유지하므로, 삭제된 품목을 참조하는 고아 거래가 존재할 수 있음.
      // 검증에 실패하지 않고 경고만 남기며 해당 거래는 그대로 보존한다.
      if (!inventoryIds.has(itemId)) {
        logger.warn(`Transaction ${txId} references missing inventory ${itemId} — keeping orphaned transaction`);
      }
      if (!Number.isFinite(Number(tx.quantity))) {
        res.status(400).json({ error: `Invalid quantity for transaction ${txId}` });
        return;
      }
      transactionIds.add(txId);
    }

    if (
      incomingMasterData !== undefined &&
      (!incomingMasterData || !Array.isArray(incomingMasterData.categories))
    ) {
      res.status(400).json({ error: 'masterData.categories must be an array' });
      return;
    }

    await assertZoneWritable(
      db,
      [
        ...inventory.flatMap((item: any) => [item.zoneId, item.category]),
        ...transactions.flatMap((tx: any) => [tx.zoneId, tx.category]),
      ]
    );

    // Keep old documents until all replacement documents have been written.
    const invSnapshot = await db.collection('inventory').get();
    const txSnapshot = await db.collection('transactions').get();

    // Write inventory, transactions, and optional masterData (including zoneMeta).
    const BATCH_LIMIT = 400;
    let writeBatch = db.batch();
    let batchCount = 0;

    if (
      incomingMasterData &&
      Array.isArray(incomingMasterData.categories)
    ) {
      const masterDataRef = db.collection('masterData').doc('custom');
      writeBatch.set(
        masterDataRef,
        {
          categories: incomingMasterData.categories,
          namesByCategory: incomingMasterData.namesByCategory ?? {},
          nameOrder: incomingMasterData.nameOrder ?? [],
          zoneMeta: incomingMasterData.zoneMeta ?? {},
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      );
      batchCount++;
    }

    for (const item of inventory) {
      const docId = item.id || db.collection('inventory').doc().id;
      const ref = db.collection('inventory').doc(docId);
      writeBatch.set(ref, {
        ...item,
        id: docId,
        zoneId: item.zoneId || item.category || '',
        plating: item.plating ?? '',
        spec: item.spec ?? '',
        unit: item.unit || 'EA',
        eaPerUnit: Math.max(1, toInt(item.eaPerUnit ?? 1)),
        qtyPerProduct: Number(item.qtyPerProduct) || 0,
        setGroup: item.setGroup ?? '',
        currentStock: toInt(item.currentStock),
        safeStock: toInt(item.safeStock),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount++;

      if (batchCount >= BATCH_LIMIT) {
        await writeBatch.commit();
        writeBatch = db.batch();
        batchCount = 0;
      }
    }

    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        const txId = tx.id;
        const ref = db.collection('transactions').doc(txId);
        writeBatch.set(ref, {
          ...tx,
          id: txId,
          quantity: toInt(tx.quantity),
          currentStockSnapshot: toInt(tx.currentStockSnapshot),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;

        if (batchCount >= BATCH_LIMIT) {
          await writeBatch.commit();
          writeBatch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await writeBatch.commit();
    }

    await deleteDocsInChunks(
      db,
      invSnapshot.docs.filter((doc: any) => !inventoryIds.has(doc.id))
    );
    await deleteDocsInChunks(
      db,
      txSnapshot.docs.filter((doc: any) => !transactionIds.has(doc.id))
    );

    logger.info(`KDT migration complete: ${inventory.length} inventory, ${transactions.length} transactions`);
    res.json({ message: 'ok', inventoryCount: inventory.length, transactionCount: transactions.length });
  } catch (error: any) {
    logger.error('Migration error', error);
    res.status(Number(error?.status) || 500).json({ error: error?.message || 'Migration failed' });
  }
});
