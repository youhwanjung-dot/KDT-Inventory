import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

// Admin SDK initialization (must be top-level)
admin.initializeApp();

// All Cloud Functions v2 deployed to Seoul (asia-northeast3)
setGlobalOptions({ region: 'asia-northeast3' });

// Auth Functions
export { login } from './auth';

// Excel Functions
export { processExcelImport } from './excel';

// Master Data (ZONE + Sort Order + 2nd-phase Zone Meta)
export { masterData } from './masterData';

// Inventory CRUD Functions
export { inventory } from './inventory';

// Transaction CRUD Functions
export { transactions } from './transactions';

// Migration (DB Reset / Restore)
export { migration } from './migration';

// User Management (Users / Roles / IN-OUT Permissions)
export { users } from './users';

export const healthCheck = onRequest((_request, response) => {
  logger.info('KDT-Inventory healthCheck OK');
  response.json({ status: 'ok', service: 'kdt-inventory', region: 'asia-northeast3' });
});
