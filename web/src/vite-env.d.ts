/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API?: string;
	readonly VITE_DEV_EMAIL?: string;
	readonly VITE_DEV_PASSWORD?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
