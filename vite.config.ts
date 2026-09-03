import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Dos páginas: la pantalla y el mando. El teléfono abre /control.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
});
