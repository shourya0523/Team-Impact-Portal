import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the static build works from any path (Vercel root or a sub-folder).
export default defineConfig({ base: './', plugins: [react()] });
