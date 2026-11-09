import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800, // kB: three.js alone is over the 500 kB default, and it is cached apart from the game
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } } },
  },
});
