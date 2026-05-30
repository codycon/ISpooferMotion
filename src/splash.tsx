import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SplashLoader from './components/layout/SplashLoader';
import './index.css';
import './utils/debugLogger';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main data-tauri-drag-region className="dark text-text-primary bg-bg-base w-screen h-screen">
      <SplashLoader handoffWindow />
    </main>
  </StrictMode>,
);
