/// <reference types="vite-plus/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;

interface ImportMetaEnv {
  readonly VITE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
