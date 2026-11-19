import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

const TX_COLLECTION = 'transactions';
const INV_COLLECTION = 'inventory';

// KDT manages all stock & transactions in integer EA (C1 confirmed)
const toInt = (val: unknown): number => Math.round(Number(val) || 0);

export const transactions = onRequest({ cors: true }, async (req, res) => {
  const db = admin.firestore();

  try {
    if (req.method === 'GET') {
      const snapshot = await db.collection(TX_COLLECTION).get();
      const txList = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      res.json(txList);
      return;
    }

    if (req.method === 'POST') {
      const tx = req.body;
      if (!tx || !tx.itemId) {
        res.status(400).json({ error: 'itemId is required' });
        return;
      }

      const txId = tx.id || `TX-${Date.now()}`;
      const qty = toInt(tx.quantity);
      const delta = tx.type === 'IN' ? qty : -qty;
      const invRef = db.collection(INV_COLLECTION).doc(tx.itemId);

      let currentStock = 0;

      await db.runTransaction(async (transaction) => {
        const invDoc = await transaction.get(invRef);
        if (invDoc.exists) {
          const invData = invDoc.data()!;
          currentStock = toInt(invData.currentStock) + delta;
          transaction.update(invRef, {
            currentStock,
            lastUpdated: tx.date || new Date().toISOString().slice(0, 10),
          });
        } else {
          currentStock = Math.max(0, delta);
          transaction.set(
            invRef,
            {
              id: tx.itemId,
              name: tx.itemName || '',
              category: tx.category || '',
              zoneId: tx.zoneId || tx.category || '',
              plating: tx.plating || '',
              spec: tx.spec || '',
              unit: 'EA',
              eaPerUnit: 1,
              currentStock,
              safeStock: 0,
              lastUpdated: tx.date || new Date().toISOString().slice(0, 10),
            },
            { merge: true }
          );
        }

        const txRef = db.collection(TX_COLLECTION).doc(txId);
        transaction.set(txRef, {
          ...tx,
          id: txId,
          quantity: qty,
          currentStockSnapshot: currentStock,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      logger.info('KDT transaction created', { txId, itemId: tx.itemId, delta });
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
      const txDoc = await txRef.get();

      if (!txDoc.exists) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const oldTx = txDoc.data()!;
      const newTx = { ...oldTx, ...updates, id: txId, quantity: toInt(updates.quantity ?? oldTx.quantity) };

      const oldDelta = (oldTx.type === 'IN' ? 1 : -1) * toInt(oldTx.quantity);
      const newDelta = (newTx.type === 'IN' ? 1 : -1) * toInt(newTx.quantity);
      const netDelta = newDelta - oldDelta;

      if (netDelta !== 0) {
        const invRef = db.collection(INV_COLLECTION).doc(newTx.itemId);
        const invDoc = await invRef.get();
        if (invDoc.exists) {
          const currentStock = toInt(invDoc.data()!.currentStock) + netDelta;
          await invRef.update({
            currentStock,
            lastUpdated: newTx.date || new Date().toISOString().slice(0, 10),
          });
          newTx.currentStockSnapshot = currentStock;
        }
      }

      await txRef.set(newTx, { merge: true });
      logger.info('KDT transaction updated', { txId, netDelta });
      res.json({ message: 'ok' });
      return;
    }

    if (req.method === 'DELETE') {
      const pathParts = req.path.split('/').filter(Boolean);
      const txId = decodeURIComponent(pathParts[pathParts.length - 1] || '');

      if (!txId || txId === 'transaction') {
        res.status(400).json({ error: 'Transaction ID is required' });
        return;
      }

      let txRef = db.collection(TX_COLLECTION).doc(txId);
      let txDoc = await txRef.get();

      if (!txDoc.exists) {
        const querySnap = await db.collection(TX_COLLECTION).where('id', '==', txId).limit(1).get();
        if (!querySnap.empty) {
          txRef = querySnap.docs[0].ref as admin.firestore.DocumentReference;
          txDoc = querySnap.docs[0];
        }
      }

      if (!txDoc.exists) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const tx = txDoc.data()!;
      const revertDelta = tx.type === 'IN' ? -toInt(tx.quantity) : toInt(tx.quantity);

      if (tx.itemId) {
        const invRef = db.collection(INV_COLLECTION).doc(tx.itemId);
        const invDoc = await invRef.get();
        if (invDoc.exists) {
          const currentStock = toInt(invDoc.data()!.currentStock) + revertDelta;
          await invRef.update({
            currentStock,
            lastUpdated: new Date().toISOString().slice(0, 10),
          });
        } else {
          const invQuery = await db.collection(INV_COLLECTION).where('id', '==', tx.itemId).limit(1).get();
          if (!invQuery.empty) {
            const currentStock = toInt(invQuery.docs[0].data().currentStock) + revertDelta;
            await invQuery.docs[0].ref.update({
              currentStock,
              lastUpdated: new Date().toISOString().slice(0, 10),
            });
          }
        }
      }

      await txRef.delete();
      logger.info('KDT transaction deleted', { txId });
      res.json({ message: 'ok' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logger.error('Transaction error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
