/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEV_BASE_URL: string;
  readonly VITE_CHAT_WEBSOCKET_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
