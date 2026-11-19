let _admin: any = null;
let _initialized = false;

export function getAdmin(): any {
  if (!_admin) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _admin = require('firebase-admin');
  }
  if (!_initialized) {
    if (!_admin.apps || _admin.apps.length === 0) {
      _admin.initializeApp();
    }
    _initialized = true;
  }
  return _admin;
}

export function ensureAdminApp(): void {
  // No-op at module discovery time! Actual firebase-admin load happens on first request.
}
