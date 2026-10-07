import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@team-impact/ui-tokens/tokens.css';
import './ui/ui.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
