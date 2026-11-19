import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

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
  const { inventory, transactions, masterData: incomingMasterData } = req.body;

  if (!Array.isArray(inventory)) {
    res.status(400).json({ error: 'inventory array is required' });
    return;
  }

  try {
    // Step 1: Delete existing inventory and transactions safely in chunks
    const invSnapshot = await db.collection('inventory').get();
    const txSnapshot = await db.collection('transactions').get();
    await deleteDocsInChunks(db, invSnapshot.docs);
    await deleteDocsInChunks(db, txSnapshot.docs);

    logger.info(`Deleted ${invSnapshot.size} inventory + ${txSnapshot.size} transactions`);

    // Step 2: Write inventory + optional masterData (including zoneMeta)
    const BATCH_LIMIT = 400;
    let writeBatch = db.batch();
    let batchCount = 0;

    if (
      incomingMasterData &&
      Array.isArray(incomingMasterData.categories) &&
      incomingMasterData.categories.length > 0
    ) {
      const masterDataRef = db.collection('masterData').doc('custom');
      writeBatch.set(
        masterDataRef,
        {
          categories: incomingMasterData.categories,
          namesByCategory: incomingMasterData.namesByCategory ?? {},
          nameOrder: incomingMasterData.nameOrder ?? [],
          ...(incomingMasterData.zoneMeta ? { zoneMeta: incomingMasterData.zoneMeta } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
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
        const txId = tx.id || `TX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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

    const txCount = Array.isArray(transactions) ? transactions.length : 0;
    logger.info(`KDT migration complete: ${inventory.length} inventory, ${txCount} transactions`);
    res.json({ message: 'ok', inventoryCount: inventory.length, transactionCount: txCount });
  } catch (error) {
    logger.error('Migration error', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});
