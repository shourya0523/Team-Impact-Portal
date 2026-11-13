// Bundles the API for production. Workspace packages (@team-impact/*) ship as TypeScript
// source, so they are bundled in; third-party dependencies stay external and load from node_modules.
import { build } from 'esbuild';
import { copyFileSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@team-impact/'));

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
});

// The resume reader runs pdf.js in a worker thread from this plain-JS file (src/resume/pdf.ts
// resolves it next to the running module), so it ships beside the bundle.
copyFileSync('src/resume/pdf-worker.mjs', 'dist/pdf-worker.mjs');
