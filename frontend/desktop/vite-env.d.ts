/// <reference types="vite/client" />

// Build-time constants & MODE Flags injected via vite.config.ts from Version.json
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __MOCKUP_MODE__: boolean;
declare const __STORAGE_MODE__: 'Cloud' | 'Local';
