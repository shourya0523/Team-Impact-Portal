import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokensToCss } from '../src/css';

writeFileSync(fileURLToPath(new URL('../src/tokens.css', import.meta.url)), tokensToCss());
