/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WHEEL_URL?: string;
  readonly VITE_PYODIDE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
