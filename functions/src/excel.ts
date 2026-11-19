import { getAdmin } from './adminApp';
const admin: any = new Proxy({}, { get: (_t, prop) => getAdmin()[prop] });
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

interface ExcelImportData {
    items: any[]; // Excel에서 파싱된 JSON 데이터
}

export const processExcelImport = onCall<ExcelImportData>(async (request) => {
    // 1. 권한 확인 (관리자만 가능)
    if (!request.auth || request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can import data');
    }

    const { items } = request.data;

    if (!Array.isArray(items) || items.length === 0) {
        throw new HttpsError('invalid-argument', 'No items to import');
    }

    logger.info(`Starting import of ${items.length} items by ${request.auth.uid}`);

    const batchSize = 400; // Firestore batch limit is 500
    let importedCount = 0;
    let batch = admin.firestore().batch();

    try {
        for (const [index, item] of items.entries()) {
            // 필수 필드 확인 (예시)
            if (!item.name) continue;

            const docRef = admin.firestore().collection('inventory').doc(); // Auto ID

            batch.set(docRef, {
                ...item,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid,
                currentStock: Number(item.currentStock) || 0,
                safeStock: Number(item.safeStock) || 0
            });

            importedCount++;

            // Batch commit every 400 items
            if ((index + 1) % batchSize === 0) {
                await batch.commit();
                batch = admin.firestore().batch();
                logger.info(`Imported ${index + 1} items...`);
            }
        }

        // Commit remaining items
        await batch.commit();

        logger.info(`Successfully imported ${importedCount} items.`);
        return { success: true, count: importedCount };

    } catch (error) {
        logger.error("Import failed", error);
        throw new HttpsError('internal', 'Import failed');
    }
});
