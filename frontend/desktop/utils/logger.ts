// Simple logger for tracking user actions
export class ActionLogger {
  static log(action: string, details: Record<string, any> = {}) {
    console.log(`[ACTION LOG] ${new Date().toISOString()}: ${action}`, details);
  }
}
