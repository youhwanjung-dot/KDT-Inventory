import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

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

      await db.collection(COLLECTION).doc(docId).set(payload, { merge: true });
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

      const docRef = db.collection(COLLECTION).doc(itemId);
      const doc = await docRef.get();

      if (doc.exists) {
        await docRef.delete();
        logger.info('KDT inventory item deleted', { itemId });
        res.json({ message: 'ok' });
        return;
      }

      const querySnap = await db.collection(COLLECTION).where('id', '==', itemId).limit(1).get();
      if (!querySnap.empty) {
        await querySnap.docs[0].ref.delete();
        res.json({ message: 'ok' });
        return;
      }

      res.status(404).json({ error: 'Item not found in database' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logger.error('Inventory error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
