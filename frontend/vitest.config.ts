import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Configuração do Vitest para o frontend Next.js/React.
 * - Ambiente: jsdom (simula o browser)
 * - Alias @/: aponta para src/ (mesmo que o tsconfig.json)
 * - Globals: true (describe, it, expect sem import explícito)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
