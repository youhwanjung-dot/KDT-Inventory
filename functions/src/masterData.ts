import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

const COLLECTION = 'masterData';
const DOC_ID = 'custom';

/**
 * GET  /masterData - Retrieve ZONE master data (categories, namesByCategory, nameOrder, zoneMeta)
 * POST /masterData - Save ZONE master data
 */
export const masterData = onRequest({ cors: true }, async (req, res) => {
  const db = admin.firestore();
  try {
    if (req.method === 'GET') {
      const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
      if (!doc.exists) {
        res.json({ categories: [], namesByCategory: {}, nameOrder: [], zoneMeta: {} });
        return;
      }
      const data = doc.data() || {};
      res.json({
        categories: Array.isArray(data.categories) ? data.categories : [],
        namesByCategory: data.namesByCategory && typeof data.namesByCategory === 'object' ? data.namesByCategory : {},
        nameOrder: Array.isArray(data.nameOrder) ? data.nameOrder : [],
        zoneMeta: data.zoneMeta && typeof data.zoneMeta === 'object' ? data.zoneMeta : {},
      });
      return;
    }

    if (req.method === 'POST') {
      const data = req.body;
      const categories = Array.isArray(data?.categories) ? data.categories : [];
      const namesByCategory = data?.namesByCategory && typeof data.namesByCategory === 'object' ? data.namesByCategory : {};
      const nameOrder = Array.isArray(data?.nameOrder) ? data.nameOrder : [];
      const zoneMeta = data?.zoneMeta && typeof data.zoneMeta === 'object' ? data.zoneMeta : undefined;

      const payload: Record<string, any> = {
        categories,
        namesByCategory,
        nameOrder,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (zoneMeta !== undefined) {
        payload.zoneMeta = zoneMeta;
      }

      await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });
      logger.info('KDT Master data saved', { categoriesCount: categories.length, zoneMetaCount: zoneMeta ? Object.keys(zoneMeta).length : 0 });
      res.json({ message: 'ok' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    logger.error('masterData error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
